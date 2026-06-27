/**
 * EET — nonparticipantsreport.js
 * Fixed: now respects the main month filter (window._eetSelectedMonth)
 * instead of always defaulting to today's calendar month.
 */

document.addEventListener('DOMContentLoaded', () => {

  const MASTER_EMPLOYEES_URL = 'https://docs.google.com/spreadsheets/d/1Za1CrlzzXpQjB3yZHjL2ZpRkjXgkVmLHH_LtXJq9K5o/export?format=csv&gid=2120288173';

  const $ = id => document.getElementById(id);

  const downloadVisitBtn    = $('downloadNonParticipantsInVisitBtn');
  const downloadCallBtn     = $('downloadNonParticipantsInCallBtn');
  const visitDisplay        = $('nonParticipantsInVisitDisplay');
  const callDisplay         = $('nonParticipantsInCallDisplay');
  const visitTableBody      = document.querySelector('#nonParticipantsInVisitTable tbody');
  const callTableBody       = document.querySelector('#nonParticipantsInCallTable tbody');
  const visitMessage        = $('nonParticipantsInVisitMessage');
  const callMessage         = $('nonParticipantsInCallMessage');
  const mainMessage         = $('nonParticipantsMessage');

  let nonVisit = [], nonCall = [];

  // ─── Exposed to core.js tab router ───────────────────────────────────────
  window.generateAndDisplayNonParticipantsReport = generateReport;

  // ─── Download buttons ────────────────────────────────────────────────────
  downloadVisitBtn && downloadVisitBtn.addEventListener('click', () => handleDownload(nonVisit, 'non_participants_visit.csv'));
  downloadCallBtn  && downloadCallBtn.addEventListener('click',  () => handleDownload(nonCall,  'non_participants_call.csv'));

  // ─── Main ────────────────────────────────────────────────────────────────

  async function generateReport() {
    resetDisplay();
    showMsg(mainMessage, 'Generating report…', 'info');

    // 1. Fetch master employees
    const masterCSV = await fetchCSV(MASTER_EMPLOYEES_URL);
    if (!masterCSV) { showMsg(mainMessage, 'Failed to load Master Employee data.', 'error'); return; }
    const masterEmployees = parseMasterCSV(masterCSV);
    if (!masterEmployees.length) { showMsg(mainMessage, 'Master employee list is empty.', 'info'); return; }

    // 2. Get canvassing data from core.js
    if (!window.allCanvassingData || !window.allCanvassingData.length) {
      showMsg(mainMessage, 'Canvassing data not yet loaded.', 'error'); return;
    }

    // 3. Determine target month
    // core.js sets window._eetSelectedMonth when this tab is activated
    const selectedMonth = window._eetSelectedMonth || getCurrentMonthYear();
    const filtered = filterByMonth(window.allCanvassingData, selectedMonth, window.HEADER_ACTIVITY_TYPE || 'Activity Type');

    // 4. Compute participant sets
    const visitParticipants = new Set(
      filtered.filter(e => (e[window.HEADER_ACTIVITY_TYPE]||'').toLowerCase() === 'visit').map(e => e[window.HEADER_EMP_CODE || 'Employee Code'])
    );
    const callParticipants = new Set(
      filtered.filter(e => (e[window.HEADER_ACTIVITY_TYPE]||'').toLowerCase() === 'calls').map(e => e[window.HEADER_EMP_CODE || 'Employee Code'])
    );

    // 5. Filter non-participants
    nonVisit = masterEmployees.filter(e => !visitParticipants.has(e['Employee Code']));
    nonCall  = masterEmployees.filter(e => !callParticipants.has(e['Employee Code']));

    // 6. Render
    let anyData = false;

    if (populateTable(visitTableBody, nonVisit)) {
      visitDisplay.style.display = 'block';
      showMsg(visitMessage, `${nonVisit.length} non-participants in Visits for ${selectedMonth}.`, 'success');
      anyData = true;
    } else {
      showMsg(visitMessage, 'All employees participated in Visits this month!', 'info');
    }

    if (populateTable(callTableBody, nonCall)) {
      callDisplay.style.display = 'block';
      showMsg(callMessage, `${nonCall.length} non-participants in Calls for ${selectedMonth}.`, 'success');
      anyData = true;
    } else {
      showMsg(callMessage, 'All employees participated in Calls this month!', 'info');
    }

    showMsg(mainMessage, anyData
      ? `Report generated for ${selectedMonth}.`
      : `All employees participated in both Visits and Calls for ${selectedMonth}.`,
      anyData ? 'success' : 'info'
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function resetDisplay() {
    [visitDisplay, callDisplay].forEach(el => { if(el) el.style.display = 'none'; });
    [visitTableBody, callTableBody].forEach(el => { if(el) el.innerHTML = ''; });
    [mainMessage, visitMessage, callMessage].forEach(el => { if(el) el.style.display = 'none'; });
    nonVisit = []; nonCall = [];
  }

  function getCurrentMonthYear() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  /**
   * Filter canvassing data by month.
   * selectedMonth can be:
   *   - core.js format: "6-2026" (M-YYYY)
   *   - legacy format: "2026-06" (YYYY-MM)
   */
  function filterByMonth(data, selectedMonth, activityTypeHeader) {
    if (!selectedMonth) return data;

    // Parse either format
    let selMonth, selYear;
    if (selectedMonth.includes('-')) {
      const parts = selectedMonth.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM format
        selYear  = parseInt(parts[0]);
        selMonth = parseInt(parts[1]) - 1;
      } else {
        // M-YYYY format (core.js format)
        selMonth = parseInt(parts[0]) - 1;
        selYear  = parseInt(parts[1]);
      }
    } else return data;

    return data.filter(entry => {
      const ts = new Date(entry['Timestamp'] || entry['timestamp']);
      if (!isNaN(ts.getTime())) {
        return ts.getMonth() === selMonth && ts.getFullYear() === selYear;
      }
      // Fallback: try 'Date' column in dd/mm/yyyy format
      const dateStr = entry['Date'] || '';
      const parts   = dateStr.split('/');
      if (parts.length === 3) {
        return parseInt(parts[1])-1 === selMonth && parseInt(parts[2]) === selYear;
      }
      return false;
    });
  }

  async function fetchCSV(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.error('fetchCSV error:', e);
      return null;
    }
  }

  function parseMasterCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    return lines.slice(1).map((line, i) => {
      const values = parseCSVLine(line);
      if (values.length < 5) return null;
      return { 'Employee Code': values[0], 'Employee Name': values[1], 'Branch Name': values[2], 'Designation': values[3], 'Division': values[4] };
    }).filter(Boolean);
  }

  function parseCSVLine(line) {
    const result = [];
    let inQuote = false, field = '';
    for (const char of line) {
      if (char === '"')           inQuote = !inQuote;
      else if (char === ',' && !inQuote) { result.push(field.trim()); field = ''; }
      else                        field += char;
    }
    result.push(field.trim());
    return result;
  }

  function populateTable(tbody, employees) {
    if (!tbody || !employees.length) return false;
    tbody.innerHTML = employees.map((emp, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${emp['Employee Code']}</td>
        <td>${emp['Employee Name']}</td>
        <td>${emp['Division']}</td>
        <td>${emp['Designation']}</td>
      </tr>`).join('');
    return true;
  }

  function handleDownload(employees, filename) {
    if (!employees.length) { alert('No data to download.'); return; }
    const headers = ['Employee Code','Employee Name','Branch Name','Designation','Division'];
    const csv = [headers, ...employees.map(e => headers.map(h => e[h]||''))].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href:url, download:filename, style:'visibility:hidden' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showMsg(el, msg, type) {
    if (!el) return;
    el.innerHTML = `<div class="message ${type}">${msg}</div>`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

});
