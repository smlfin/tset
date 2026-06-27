/**
 * EET — analytics.js
 * New Analytics tab: KPIs, at-risk staff, lead quality, branch momentum,
 * lead source breakdown, early warning, follow-ups due today.
 *
 * Called by core.js via window.renderAnalytics(...)
 */
document.addEventListener('DOMContentLoaded', () => {

  const analyticsDisplay = document.getElementById('analyticsDisplay');

  window.renderAnalytics = function(
    allData, selectedMonthValue,
    TARGETS, H,
    codeToName, codeToDesig,
    PREDEFINED_BRANCHES,
    filterDataByMonth, calculateTotalActivity
  ) {
    if (!analyticsDisplay) return;
    if (!allData || !allData.length) {
      analyticsDisplay.innerHTML = '<p>No data loaded yet.</p>'; return;
    }

    const MONTHLY_WORKING_DAYS = 25;
    const data = filterDataByMonth(allData, selectedMonthValue);
    const now  = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const daysElapsed = now.getDate();
    const monthPct    = daysElapsed / daysInMonth;

    // ── Month totals
    const { totalActivity: monthTotals } = calculateTotalActivity(data);
    const activeBranches = new Set(data.map(e => e[H.BRANCH])).size;
    const activeStaff    = new Set(data.map(e => e[H.EMP_CODE])).size;

    // ── Per-employee stats
    const empCodes = [...new Set(data.map(e => e[H.EMP_CODE]))];
    const empStats = empCodes.map(code => {
      const entries   = data.filter(e => e[H.EMP_CODE] === code);
      const { totalActivity } = calculateTotalActivity(entries);
      const desig     = codeToDesig[code]   || 'Default';
      const targets   = TARGETS[desig]      || TARGETS['Default'];
      const visitTgt  = targets['Visit']    || 5;
      const projected = monthPct > 0 ? Math.round(totalActivity['Visit'] / monthPct) : 0;
      const leadScore = calcLeadScore(entries, H);
      return {
        code, name: codeToName[code]||code, desig,
        branch: entries[0]?.[H.BRANCH] || 'N/A',
        totalActivity, targets, projected,
        onTrack: projected >= visitTgt,
        leadScore, entryCount: entries.length
      };
    });

    // ── Branch momentum
    const branchMomentum = computeBranchMomentum(
      allData, selectedMonthValue, PREDEFINED_BRANCHES, H, filterDataByMonth, calculateTotalActivity
    );

    // ── Lead source breakdown
    const leadSources = {};
    data.forEach(e => {
      const src = (e[H.LEAD_SOURCE]||'').trim() || '(not specified)';
      leadSources[src] = (leadSources[src]||0) + 1;
    });

    // ── At-risk employees
    const atRisk = empStats.filter(e => !e.onTrack).sort((a,b) => a.projected - b.projected);

    // ── Early warning: zero activity in last 5 working days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5);
    const earlyWarning = empCodes.map(code => {
      const entries = allData.filter(e => e[H.EMP_CODE] === code);
      const latest  = entries.reduce((lx, e) => {
        const d = new Date(e[H.TIMESTAMP]);
        return (!isNaN(d) && d > lx) ? d : lx;
      }, new Date(0));
      return latest < cutoff
        ? { name: codeToName[code]||code, lastSeen: latest.getTime()===0 ? 'Never' : latest.toLocaleDateString('en-IN') }
        : null;
    }).filter(Boolean).sort((a,b) => a.lastSeen.localeCompare(b.lastSeen));

    // ── Follow-ups due today
    const today = now.toDateString();
    const followUpsToday = allData.filter(e => {
      if (!e[H.FOLLOWUP_DATE]) return false;
      const d = new Date(e[H.FOLLOWUP_DATE]);
      return !isNaN(d) && d.toDateString() === today;
    });

    // ── RENDER ───────────────────────────────────────────────────────────────
    let html = '<div class="analytics-grid">';

    // Card 1 — Month Summary
    html += card('📋 Month Summary', `
      <div class="kpi-grid">
        ${km('Visits',           monthTotals['Visit'])}
        ${km('Calls',            monthTotals['Call'])}
        ${km('New Leads',        monthTotals['New Customer Leads'])}
        ${km('References',       monthTotals['Reference'])}
        ${km('Active Branches',  activeBranches)}
        ${km('Active Staff',     activeStaff)}
      </div>
      <div class="month-progress-bar-wrap">
        <span>Month elapsed: ${Math.round(monthPct*100)}%</span>
        <div class="progress-bar-container-small" style="margin-top:6px">
          <div class="progress-bar warning-medium" style="width:${Math.round(monthPct*100)}%">${Math.round(monthPct*100)}%</div>
        </div>
      </div>`);

    // Card 2 — At-Risk
    html += card(`⚠️ Visit Target At-Risk (${atRisk.length} staff)`,
      atRisk.length
        ? `<table class="analytics-table"><thead>
             <tr><th>Employee</th><th>Branch</th><th>Visits Now</th><th>Projected EOM</th><th>Target</th><th>Gap</th></tr>
           </thead><tbody>${atRisk.map(e => `<tr>
             <td>${e.name}</td><td>${e.branch}</td>
             <td>${e.totalActivity['Visit']}</td>
             <td class="proj-risk">${e.projected}</td>
             <td>${e.targets['Visit']}</td>
             <td class="proj-risk">−${e.targets['Visit'] - e.projected}</td>
           </tr>`).join('')}</tbody></table>`
        : '<p class="good-msg">✓ All staff on track for Visit target.</p>'
    );

    // Card 3 — Lead Quality Score
    const topLeaders = [...empStats].sort((a,b) => b.leadScore - a.leadScore).slice(0, 10);
    html += card('🏆 Lead Quality Score — Top 10', `
      <p class="analytics-note">Score = entries with phone + product interest + new customer type.</p>
      <table class="analytics-table"><thead>
        <tr><th>Employee</th><th>Branch</th><th>Score</th><th>Entries</th></tr>
      </thead><tbody>
        ${topLeaders.map((e,i) => `<tr>
          <td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':''} ${e.name}</td>
          <td>${e.branch}</td>
          <td><strong>${e.leadScore}</strong></td>
          <td>${e.entryCount}</td>
        </tr>`).join('')}
      </tbody></table>`);

    // Card 4 — Branch Momentum
    html += card('📈 Branch Momentum (vs Last Month)', `
      <table class="analytics-table"><thead>
        <tr><th>Branch</th><th>Last Month</th><th>This Month</th><th>Change</th></tr>
      </thead><tbody>
        ${branchMomentum.map(b => {
          const delta = b.current - b.previous;
          const cls   = delta > 0 ? 'momentum-up' : delta < 0 ? 'momentum-down' : '';
          const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
          return `<tr>
            <td>${b.branch}</td><td>${b.previous}</td><td>${b.current}</td>
            <td class="${cls}">${arrow} ${Math.abs(delta)}</td>
          </tr>`;
        }).join('')}
      </tbody></table>`);

    // Card 5 — Lead Source
    html += card('🔍 Lead Source Breakdown',
      Object.keys(leadSources).length
        ? `<table class="analytics-table"><thead>
             <tr><th>Lead Source</th><th>Count</th><th>Share</th></tr>
           </thead><tbody>
             ${Object.entries(leadSources).sort(([,a],[,b]) => b-a).map(([src, cnt]) => `<tr>
               <td>${src}</td><td>${cnt}</td>
               <td>${Math.round(cnt/data.length*100)}%</td>
             </tr>`).join('')}
           </tbody></table>`
        : '<p>No lead source data available.</p>'
    );

    // Card 6 — Early Warning
    html += card(`🚨 Zero Activity — Last 5 Days (${earlyWarning.length} staff)`,
      earlyWarning.length
        ? `<table class="analytics-table"><thead>
             <tr><th>Employee</th><th>Last Activity</th></tr>
           </thead><tbody>
             ${earlyWarning.map(e => `<tr>
               <td>${e.name}</td><td class="proj-risk">${e.lastSeen}</td>
             </tr>`).join('')}
           </tbody></table>`
        : '<p class="good-msg">✓ All active staff have recent entries.</p>'
    );

    // Card 7 — Follow-ups Due Today
    html += card(`📅 Follow-ups Due Today (${followUpsToday.length})`,
      followUpsToday.length
        ? `<table class="analytics-table"><thead>
             <tr><th>Employee</th><th>Prospect</th><th>Branch</th></tr>
           </thead><tbody>
             ${followUpsToday.map(e => `<tr>
               <td>${codeToName[e[H.EMP_CODE]]||e[H.EMP_CODE]}</td>
               <td>${e[H.PROSPECT_NAME]||'N/A'}</td>
               <td>${e[H.BRANCH]||'N/A'}</td>
             </tr>`).join('')}
           </tbody></table>`
        : '<p class="good-msg">No follow-ups due today.</p>'
    );

    html += '</div>';
    analyticsDisplay.innerHTML = html;
  };

  /* ── Helpers ─────────────────────────────────────────────────────────────── */

  const card = (title, content) =>
    `<div class="analytics-card"><h3>${title}</h3>${content}</div>`;

  const km = (label, val) =>
    `<div class="kpi-mini"><div class="kpi-mini-val">${val}</div><div class="kpi-mini-label">${label}</div></div>`;

  function calcLeadScore(entries, H) {
    return entries.reduce((score, e) => {
      if ((e[H.PHONE]   ||'').trim())                              score++;
      if ((e[H.PRODUCT] ||'').trim())                              score++;
      if ((e[H.CUSTOMER_TYPE]||'').trim().toLowerCase() === 'new') score++;
      return score;
    }, 0);
  }

  function computeBranchMomentum(allData, selectedMonthValue, branches, H, filterByMonth, calcActivity) {
    let [mStr, yStr] = (selectedMonthValue||'').split('-');
    let m = parseInt(mStr || new Date().getMonth()+1);
    let y = parseInt(yStr || new Date().getFullYear());
    m--; if (m < 1) { m = 12; y--; }
    const lastMonthVal = `${m}-${y}`;

    const curr = filterByMonth(allData, selectedMonthValue);
    const prev = filterByMonth(allData, lastMonthVal);

    return branches.map(branch => ({
      branch,
      current:  calcActivity(curr.filter(e => e[H.BRANCH]===branch)).totalActivity['Visit'],
      previous: calcActivity(prev.filter(e => e[H.BRANCH]===branch)).totalActivity['Visit']
    })).sort((a,b) => (b.current - b.previous) - (a.current - a.previous));
  }

}); // end DOMContentLoaded
