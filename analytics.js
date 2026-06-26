/**
 * EET — analytics.js
 * New Analytics tab: KPIs, predictive projections, lead quality, branch momentum,
 * follow-up gap, lead source breakdown, zero-activity early warning.
 */

document.addEventListener('DOMContentLoaded', () => {

  const analyticsDisplay = document.getElementById('analyticsDisplay');

  /**
   * Main entry point — called by core.js when Analytics tab is activated
   * or month dropdown changes.
   */
  window.renderAnalytics = function(
    allData, selectedMonthValue, TARGETS, H,
    codeToName, codeToDesig, PREDEFINED_BRANCHES,
    filterDataByMonth, calculateTotalActivity
  ) {
    if (!analyticsDisplay) return;
    if (!allData || !allData.length) {
      analyticsDisplay.innerHTML = '<p>No data loaded yet.</p>';
      return;
    }

    const data     = filterDataByMonth(allData, selectedMonthValue);
    const now      = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const daysElapsed = now.getDate();
    const monthPct    = daysElapsed / daysInMonth;

    // ── 1. Month-level totals
    const { totalActivity: monthTotals } = calculateTotalActivity(data);
    const activeBranches = new Set(data.map(e => e[H.BRANCH])).size;
    const activeStaff    = new Set(data.map(e => e[H.EMP_CODE])).size;

    // ── 2. Per-employee stats
    const empCodes = [...new Set(data.map(e => e[H.EMP_CODE]))];
    const empStats = empCodes.map(code => {
      const entries = data.filter(e => e[H.EMP_CODE] === code);
      const { totalActivity } = calculateTotalActivity(entries);
      const desig   = codeToDesig[code] || 'Default';
      const targets = TARGETS[desig]    || TARGETS['Default'];
      const visitTarget = targets['Visit'] || 5;
      const projected   = monthPct > 0 ? Math.round(totalActivity['Visit'] / monthPct) : 0;
      const onTrack     = projected >= visitTarget;
      const leadScore   = calcLeadScore(entries, H);
      return {
        code, name: codeToName[code]||code, desig,
        branch: entries[0]?.[H.BRANCH]||'N/A',
        totalActivity, targets, projected, onTrack, leadScore,
        entryCount: entries.length
      };
    });

    // ── 3. Branch momentum (visits this month vs last month — from full data)
    const branchMomentum = computeBranchMomentum(allData, selectedMonthValue, PREDEFINED_BRANCHES, H, filterDataByMonth, calculateTotalActivity);

    // ── 4. Lead source breakdown
    const leadSources = computeLeadSources(data, H);

    // ── 5. At-risk employees (on-track visit projection < target)
    const atRisk = empStats.filter(e => !e.onTrack).sort((a,b) => (a.projected - b.projected));

    // ── 6. Zero-activity early warning (last 5 days of full data)
    const earlyWarning = computeEarlyWarning(allData, H, codeToName, empCodes);

    // ── 7. Follow-up due today
    const followUpsToday = allData.filter(e => {
      if (!e[H.FOLLOWUP_DATE]) return false;
      const d = new Date(e[H.FOLLOWUP_DATE]);
      return !isNaN(d) && d.toDateString() === now.toDateString();
    });

    // ── RENDER ──────────────────────────────────────────────────────────────
    let html = `<div class="analytics-grid">`;

    // Card 1 — Month Summary
    html += card('📋 Month Summary', `
      <div class="kpi-grid">
        ${kpiMini('Total Visits',   monthTotals['Visit'])}
        ${kpiMini('Total Calls',    monthTotals['Call'])}
        ${kpiMini('New Leads',      monthTotals['New Customer Leads'])}
        ${kpiMini('References',     monthTotals['Reference'])}
        ${kpiMini('Active Branches',activeBranches)}
        ${kpiMini('Active Staff',   activeStaff)}
      </div>
      <div class="month-progress-bar-wrap">
        <span>Month elapsed: ${Math.round(monthPct*100)}%</span>
        <div class="progress-bar-container-small" style="margin-top:6px">
          <div class="progress-bar warning-medium" style="width:${Math.round(monthPct*100)}%">${Math.round(monthPct*100)}%</div>
        </div>
      </div>
    `);

    // Card 2 — At-Risk Employees (projected to miss Visit target)
    html += card(`⚠️ Visit Target At-Risk (${atRisk.length} staff)`, atRisk.length ? `
      <table class="analytics-table"><thead>
        <tr><th>Employee</th><th>Branch</th><th>Visits Now</th><th>Projected</th><th>Target</th><th>Gap</th></tr>
      </thead><tbody>
        ${atRisk.map(e => `<tr>
          <td>${e.name}</td>
          <td>${e.branch}</td>
          <td>${e.totalActivity['Visit']}</td>
          <td class="proj-risk">${e.projected}</td>
          <td>${e.targets['Visit']}</td>
          <td class="proj-risk">−${e.targets['Visit'] - e.projected}</td>
        </tr>`).join('')}
      </tbody></table>
    ` : `<p class="good-msg">✓ All staff on track for Visit target.</p>`);

    // Card 3 — Lead Quality Scores
    const topLeaders = [...empStats].sort((a,b) => b.leadScore - a.leadScore).slice(0,10);
    html += card('🏆 Lead Quality Score (Top 10)', `
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
      </tbody></table>
    `);

    // Card 4 — Branch Momentum
    html += card('📈 Branch Momentum (vs Last Month)', `
      <table class="analytics-table"><thead>
        <tr><th>Branch</th><th>Last Month Visits</th><th>This Month Visits</th><th>Change</th></tr>
      </thead><tbody>
        ${branchMomentum.map(b => {
          const delta = b.current - b.previous;
          const cls   = delta > 0 ? 'momentum-up' : delta < 0 ? 'momentum-down' : '';
          const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
          return `<tr>
            <td>${b.branch}</td>
            <td>${b.previous}</td>
            <td>${b.current}</td>
            <td class="${cls}">${arrow} ${Math.abs(delta)}</td>
          </tr>`;
        }).join('')}
      </tbody></table>
    `);

    // Card 5 — Lead Source Breakdown
    html += card('🔍 Lead Source Breakdown', Object.keys(leadSources).length ? `
      <table class="analytics-table"><thead>
        <tr><th>Lead Source</th><th>Count</th><th>Share</th></tr>
      </thead><tbody>
        ${Object.entries(leadSources)
          .sort(([,a],[,b]) => b-a)
          .map(([src, cnt]) => `<tr>
            <td>${src||'(not specified)'}</td>
            <td>${cnt}</td>
            <td>${Math.round(cnt/data.length*100)}%</td>
          </tr>`).join('')}
      </tbody></table>
    ` : `<p>No lead source data available.</p>`);

    // Card 6 — Early Warning (zero activity last 5 days)
    html += card(`🚨 Zero Activity — Last 5 Days (${earlyWarning.length} staff)`, earlyWarning.length ? `
      <table class="analytics-table"><thead>
        <tr><th>Employee</th><th>Last Seen</th></tr>
      </thead><tbody>
        ${earlyWarning.map(e => `<tr>
          <td>${e.name}</td>
          <td class="proj-risk">${e.lastSeen}</td>
        </tr>`).join('')}
      </tbody></table>
    ` : `<p class="good-msg">✓ All staff have recent activity.</p>`);

    // Card 7 — Follow-ups Due Today
    html += card(`📅 Follow-ups Due Today (${followUpsToday.length})`, followUpsToday.length ? `
      <table class="analytics-table"><thead>
        <tr><th>Employee</th><th>Prospect</th><th>Branch</th></tr>
      </thead><tbody>
        ${followUpsToday.map(e => `<tr>
          <td>${codeToName[e[H.EMP_CODE]]||e[H.EMP_CODE]}</td>
          <td>${e[H.PROSPECT_NAME]||'N/A'}</td>
          <td>${e[H.BRANCH]||'N/A'}</td>
        </tr>`).join('')}
      </tbody></table>
    ` : `<p class="good-msg">No follow-ups due today.</p>`);

    html += `</div>`; // close analytics-grid
    analyticsDisplay.innerHTML = html;
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────

  function card(title, content) {
    return `<div class="analytics-card"><h3>${title}</h3>${content}</div>`;
  }

  function kpiMini(label, val) {
    return `<div class="kpi-mini"><div class="kpi-mini-val">${val}</div><div class="kpi-mini-label">${label}</div></div>`;
  }

  function calcLeadScore(entries, H) {
    // +1 for phone, +1 for product interest, +1 for new customer type
    return entries.reduce((score, e) => {
      if ((e[H.PHONE]   || '').trim())                                    score++;
      if ((e[H.PRODUCT] || '').trim())                                    score++;
      if ((e[H.CUSTOMER_TYPE]||'').trim().toLowerCase() === 'new')        score++;
      return score;
    }, 0);
  }

  function computeBranchMomentum(allData, selectedMonthValue, branches, H, filterDataByMonth, calculateTotalActivity) {
    // Derive last month value string
    let [mStr, yStr] = (selectedMonthValue || '').split('-');
    let m = parseInt(mStr||new Date().getMonth()+1);
    let y = parseInt(yStr||new Date().getFullYear());
    m--; if (m < 1) { m = 12; y--; }
    const lastMonthValue = `${m}-${y}`;

    const currData = filterDataByMonth(allData, selectedMonthValue);
    const prevData = filterDataByMonth(allData, lastMonthValue);

    return branches.map(branch => {
      const curr = calculateTotalActivity(currData.filter(e => e[H.BRANCH]===branch)).totalActivity['Visit'];
      const prev = calculateTotalActivity(prevData.filter(e => e[H.BRANCH]===branch)).totalActivity['Visit'];
      return { branch, current: curr, previous: prev };
    }).sort((a,b) => (b.current - b.previous) - (a.current - a.previous));
  }

  function computeLeadSources(data, H) {
    const map = {};
    data.forEach(e => {
      const src = (e[H.LEAD_SOURCE]||'').trim() || '(not specified)';
      map[src] = (map[src]||0) + 1;
    });
    return map;
  }

  function computeEarlyWarning(allData, H, codeToName, activeCodes) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5);
    const warning = [];
    activeCodes.forEach(code => {
      const entries = allData.filter(e => e[H.EMP_CODE] === code);
      if (!entries.length) return;
      const latest = entries.reduce((latest, e) => {
        const d = new Date(e[H.TIMESTAMP]);
        return (!isNaN(d) && d > latest) ? d : latest;
      }, new Date(0));
      if (latest < cutoff) {
        warning.push({
          name: codeToName[code]||code,
          lastSeen: latest.getTime() === 0 ? 'Never' : latest.toLocaleDateString('en-IN')
        });
      }
    });
    return warning.sort((a,b) => a.lastSeen.localeCompare(b.lastSeen));
  }

}); // end DOMContentLoaded