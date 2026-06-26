/**
 * EET — core.js
 * Replaces script.js. Bugs fixed:
 *  - processData() no longer fires before login
 *  - Duplicate detailedCustomerViewTabBtn listener removed
 *  - maskPhoneNumber / maskAddress defined once
 *  - Debug console.log stripped from calculateTotalActivity
 *  - sessionStorage caching (5-min TTL) for canvassing CSV
 *  - Tab routing unified — tabhandler.js no longer needed (removed)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const ACCESS_PASSWORD_FULL         = "1";
  const ACCESS_PASSWORD_LIMITED      = "123";
  const ACCESS_PASSWORD_LIMITED_DATA = "sml4576";

  const DATA_URL  = "https://docs.google.com/spreadsheets/d/1Za1CrlzzXpQjB3yZHjL2ZpRkjXgkVmLHH_LtXJq9K5o/export?format=csv&gid=696550092";
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxe_hZyRXZdY1CbfchvH_pzIa596dxmEDnPVc4YGXWerxRmuJz30CpEbND279mR0lWf/exec";
  const CACHE_KEY  = 'eet_canvassing_data';
  const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

  const MONTHLY_WORKING_DAYS = 25;
  const TARGETS = {
    'Branch Manager':    { Visit: 10, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 },
    'Investment Staff':  { Visit: 15, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 },
    'Seniors':           { Visit: 15, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 },
    'Default':           { Visit:  5, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 }
  };

  const PREDEFINED_BRANCHES = [
    "Angamaly","Corporate Office","Edappally","Harippad","Koduvayur","Kuzhalmannam",
    "Mattanchery","Mavelikara","Nedumkandom","Nenmara","Paravoor","Perumbavoor",
    "Thiruwillamala","Thodupuzha","Chengannur","Alathur","Kottayam","Kattapana",
    "Muvattupuzha","Thiruvalla","Pathanamthitta","Kunnamkulam","HO KKM"
  ].sort();

  // Column header constants (preserve original typos — they match the Sheet)
  const H = {
    TIMESTAMP:       'Timestamp',
    DATE:            'Date',
    BRANCH:          'Branch Name',
    EMP_NAME:        'Employee Name',
    EMP_CODE:        'Employee Code',
    DESIGNATION:     'Designation',
    ACTIVITY_TYPE:   'Activity Type',
    CUSTOMER_TYPE:   'Type of Customer',
    LEAD_SOURCE:     'rLead Source',
    HOW_CONTACTED:   'How Contacted',
    PROSPECT_NAME:   'Prospect Name',
    PHONE:           'Phone Numebr(Whatsapp)',   // typo preserved
    ADDRESS:         'Address',
    PROFESSION:      'Profession',
    DOB:             'DOB/WD',
    PRODUCT:         'Prodcut Interested',        // typo preserved
    REMARKS:         'Remarks',
    FOLLOWUP_DATE:   'Next Follow-up Date',
    RELATION:        'Relation With Staff',
    FAMILY_1:        'Family Deatils -1 Name of wife/Husband',
    FAMILY_2:        'Family Deatils -2 Job of wife/Husband',
    FAMILY_3:        'Family Deatils -3 Names of Children',
    FAMILY_4:        'Family Deatils -4 Deatils of Children',
    PROFILE:         'Profile of Customer',
    MONTHLY_INCOME:  'Average Monthly Income'
  };

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let currentAccessLevel = null;
  let allCanvassingData  = [];
  let allUniqueBranches  = [];
  let allUniqueEmployees = [];
  let employeeCodeToNameMap        = {};
  let employeeCodeToDesignationMap = {};
  let selectedEmployeeCodeEntries  = [];

  // ─── DOM REFS ──────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const accessDeniedOverlay    = $('accessDeniedOverlay');
  const dashboardContent       = $('dashboardContent');
  const secretPasswordInput    = $('secretPasswordInput');
  const submitBtn              = $('submitSecretPassword');
  const passwordErrorMessage   = $('passwordErrorMessage');

  const reportDisplay          = $('reportDisplay');
  const branchSelect           = $('branchSelect');
  const employeeSelect         = $('employeeSelect');
  const employeeFilterPanel    = $('employeeFilterPanel');
  const monthSelect            = $('monthSelect');
  const viewOptions            = $('viewOptions');

  const customerViewBranchSelect   = $('customerViewBranchSelect');
  const customerViewEmployeeSelect = $('customerViewEmployeeSelect');
  const customerViewMonthSelect    = $('customerViewMonthSelect');
  const detailedCustomerReportTableBody = $('detailedCustomerReportTableBody');
  const customerDetailsContent     = $('customerDetailsContent');
  const customerCard1              = $('customerCard1');
  const customerCard2              = $('customerCard2');
  const customerCard3              = $('customerCard3');

  const addEmployeeForm            = $('addEmployeeForm');
  const bulkAddEmployeeForm        = $('bulkAddEmployeeForm');
  const deleteEmployeeForm         = $('deleteEmployeeForm');
  const employeeManagementMessage  = $('employeeManagementMessage');
  const newBranchNameInput         = $('newBranchName');
  const bulkEmployeeBranchNameInput = $('bulkEmployeeBranchName');
  const deleteEmployeeCodeInput    = $('deleteEmployeeCode');

  const downloadOverallBtn         = $('downloadOverallStaffPerformanceReportBtn');
  const detailedCustomerViewTabBtn = $('detailedCustomerViewTabBtn');
  const viewAllEntriesBtn          = $('viewAllEntriesBtn');
  const lastLoadedLabel            = $('lastLoadedLabel');
  const refreshDataBtn             = $('refreshDataBtn');
  const analyticsMonthSelect       = $('analyticsMonthSelect');

  secretPasswordInput.focus();

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  submitBtn.addEventListener('click', checkAndSetAccess);
  secretPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') checkAndSetAccess(); });

  function checkAndSetAccess() {
    const pw = secretPasswordInput.value;
    if (pw === ACCESS_PASSWORD_FULL)         { currentAccessLevel = 'full';             grantAccess(); }
    else if (pw === ACCESS_PASSWORD_LIMITED) { currentAccessLevel = 'limited';          grantAccess(); }
    else if (pw === ACCESS_PASSWORD_LIMITED_DATA) { currentAccessLevel = 'limited_data_view'; grantAccess(); }
    else {
      passwordErrorMessage.textContent = 'Incorrect password. Try again.';
      passwordErrorMessage.style.display = 'block';
      secretPasswordInput.value = '';
      secretPasswordInput.focus();
    }
  }

  function grantAccess() {
    accessDeniedOverlay.style.display = 'none';
    dashboardContent.style.display = 'block';
    applyAccessRestrictions();
    processData();  // ← only called here, after successful login
    activateTab('allBranchSnapshotTabBtn');
  }

  function applyAccessRestrictions() {
    const limited = currentAccessLevel === 'limited';
    if (downloadOverallBtn)         downloadOverallBtn.style.display         = limited ? 'none' : 'inline-block';
    if (detailedCustomerViewTabBtn) detailedCustomerViewTabBtn.style.display = limited ? 'none' : 'inline-block';
    if (viewAllEntriesBtn)          viewAllEntriesBtn.style.display          = limited ? 'none' : 'inline-block';
  }

  // ─── DATA LAYER ────────────────────────────────────────────────────────────

  async function processData(forceRefresh = false) {
    await fetchCanvassingData(forceRefresh);
    allUniqueBranches = [...PREDEFINED_BRANCHES];

    employeeCodeToNameMap        = {};
    employeeCodeToDesignationMap = {};
    allCanvassingData.forEach(e => {
      if (e[H.EMP_CODE]) {
        employeeCodeToNameMap[e[H.EMP_CODE]]        = e[H.EMP_NAME]    || e[H.EMP_CODE];
        employeeCodeToDesignationMap[e[H.EMP_CODE]] = e[H.DESIGNATION] || 'Default';
      }
    });

    allUniqueEmployees = [...new Set(allCanvassingData.map(e => e[H.EMP_CODE]))]
      .sort((a, b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

    // Expose for nonparticipantsreport.js
    window.allCanvassingData         = allCanvassingData;
    window.employeeCodeToNameMap     = employeeCodeToNameMap;
    window.HEADER_EMP_CODE           = H.EMP_CODE;
    window.HEADER_ACTIVITY_TYPE      = H.ACTIVITY_TYPE;

    populateDropdown(branchSelect, allUniqueBranches);
    populateDropdown(customerViewBranchSelect, allUniqueBranches);
    populateMonthDropdowns();
    updateKpiPulseBar();

    renderAllBranchSnapshot();
  }

  async function fetchCanvassingData(forceRefresh = false) {
    // SessionStorage cache with TTL
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            allCanvassingData = data;
            updateLastLoaded(new Date(timestamp));
            return;
          }
        }
      } catch(e) { /* cache miss */ }
    }

    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      allCanvassingData = parseCSV(csvText);
      const now = Date.now();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: allCanvassingData }));
      updateLastLoaded(new Date(now));
    } catch (err) {
      console.error('Fetch error:', err);
      showToast(`Failed to load data: ${err.message}. Showing cached data if available.`, 'error');
      allCanvassingData = allCanvassingData.length ? allCanvassingData : [];
    }
  }

  refreshDataBtn.addEventListener('click', () => processData(true));

  function updateLastLoaded(date) {
    if (lastLoadedLabel) {
      lastLoadedLabel.textContent = `Updated ${date.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}`;
    }
  }

  // ─── CSV PARSER ────────────────────────────────────────────────────────────

  function parseCSV(csv) {
    const lines = csv.split('\n').filter(l => l.trim());
    if (!lines.length) return [];
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).reduce((acc, line) => {
      const values = parseCSVLine(line);
      if (values.length === headers.length) {
        const entry = {};
        headers.forEach((h, i) => entry[h] = values[i]);
        acc.push(entry);
      }
      return acc;
    }, []);
  }

  function parseCSVLine(line) {
    const result = [];
    let inQuote = false, field = '';
    for (const char of line) {
      if (char === '"')          { inQuote = !inQuote; }
      else if (char === ',' && !inQuote) { result.push(field.trim()); field = ''; }
      else                       { field += char; }
    }
    result.push(field.trim());
    return result;
  }

  // ─── FILTERING ─────────────────────────────────────────────────────────────

  function filterDataByMonth(data, selectedMonthValue) {
    if (!selectedMonthValue) return data;
    const [mStr, yStr] = selectedMonthValue.split('-');
    const selMonth = parseInt(mStr) - 1;
    const selYear  = parseInt(yStr);
    return data.filter(entry => {
      const d = new Date(entry[H.TIMESTAMP]);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === selMonth && d.getFullYear() === selYear;
    });
  }

  // ─── KPI PULSE BAR ────────────────────────────────────────────────────────

  function updateKpiPulseBar() {
    const month = monthSelect.value;
    const data  = filterDataByMonth(allCanvassingData, month);
    const { totalActivity } = calculateTotalActivity(data);

    const activeBranches = new Set(data.map(e => e[H.BRANCH])).size;
    const activeStaff    = new Set(data.map(e => e[H.EMP_CODE])).size;

    // Month progress %
    const now    = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const monthPct = Math.round((now.getDate() / daysInMonth) * 100);

    setKpi('kpiTotalVisits',    totalActivity['Visit']);
    setKpi('kpiTotalCalls',     totalActivity['Call']);
    setKpi('kpiTotalLeads',     totalActivity['New Customer Leads']);
    setKpi('kpiActiveBranches', activeBranches);
    setKpi('kpiActiveStaff',    activeStaff);
    setKpi('kpiMonthProgress',  `${monthPct}%`);
  }

  function setKpi(id, value) {
    const el = $(id);
    if (el) el.querySelector('.kpi-val').textContent = value;
  }

  // ─── ACTIVITY CALCULATION ─────────────────────────────────────────────────
  // Debug console.logs removed

  function calculateTotalActivity(entries) {
    const totalActivity = { Visit: 0, Call: 0, Reference: 0, 'New Customer Leads': 0 };
    const productInterests = new Set();

    entries.forEach(entry => {
      const type     = (entry[H.ACTIVITY_TYPE]   || '').trim().toLowerCase();
      const custType = (entry[H.CUSTOMER_TYPE]   || '').trim().toLowerCase();
      const product  = (entry[H.PRODUCT]         || '').trim();

      if (type === 'visit')     totalActivity['Visit']++;
      else if (type === 'calls')    totalActivity['Call']++;
      else if (type === 'referance') totalActivity['Reference']++;

      if (custType === 'new') totalActivity['New Customer Leads']++;
      if (product)            productInterests.add(product);
    });

    return { totalActivity, productInterests: [...productInterests] };
  }

  function calculatePerformance(actuals, targets) {
    const perf = {};
    for (const m in targets) {
      perf[m] = targets[m] > 0 ? (actuals[m] || 0) / targets[m] * 100 : NaN;
    }
    return perf;
  }

  function getProgressBarClass(pct) {
    if (pct >= 100) return 'success';
    if (pct >= 75)  return 'warning-high';
    if (pct >= 50)  return 'warning-medium';
    if (pct > 0)    return 'warning-low';
    return 'danger';
  }

  // ─── TAB ROUTING ──────────────────────────────────────────────────────────

  const MODAL_TABS = new Set(['detailedCustomerViewTabBtn', 'julyDashboardTabBtn']);

  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.id));
  });

  // Close modals
  document.querySelectorAll('.close-button[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      $( btn.dataset.modal ).style.display = 'none';
    });
  });
  window.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
  });

  function activateTab(tabBtnId) {
    // Hide all sections
    document.querySelectorAll('.report-section').forEach(s => s.style.display = 'none');
    $('customerDetailsModal').style.display  = 'none';
    $('julyDashboardModal').style.display    = 'none';

    // Active button
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    const activeBtn = $(tabBtnId);
    if (activeBtn) activeBtn.classList.add('active');

    // Route
    if (tabBtnId === 'detailedCustomerViewTabBtn') {
      $('customerDetailsModal').style.display = 'block';
      populateMonthDropdowns();
    } else if (tabBtnId === 'julyDashboardTabBtn') {
      $('julyDashboardModal').style.display = 'block';
      if (window.loadJulyDashboardData) window.loadJulyDashboardData();
    } else if (tabBtnId === 'analyticsTabBtn') {
      $('analyticsSection').style.display = 'block';
      populateMonthDropdownSingle(analyticsMonthSelect);
      if (window.renderAnalytics) window.renderAnalytics(allCanvassingData, analyticsMonthSelect.value, TARGETS, H, employeeCodeToNameMap, employeeCodeToDesignationMap, PREDEFINED_BRANCHES, filterDataByMonth, calculateTotalActivity);
    } else if (tabBtnId === 'nonParticipantReportTabBtn') {
      $('nonParticipantReportSection').style.display = 'block';
      // Pass current month select value to non-participants report
      window._eetSelectedMonth = monthSelect.value;
      if (window.generateAndDisplayNonParticipantsReport) window.generateAndDisplayNonParticipantsReport();
    } else if (tabBtnId === 'employeeManagementTabBtn') {
      $('employeeManagementSection').style.display = 'block';
      populateDropdown(newBranchNameInput, PREDEFINED_BRANCHES);
      populateDropdown(bulkEmployeeBranchNameInput, PREDEFINED_BRANCHES);
    } else {
      // All "reports" tabs share reportsSection
      $('reportsSection').style.display = 'block';
      branchSelect.value = '';
      employeeSelect.innerHTML = '<option value="">-- Select --</option>';
      employeeFilterPanel.style.display = 'none';
      viewOptions.style.display = 'none';
      populateMonthDropdowns();

      if (tabBtnId === 'allBranchSnapshotTabBtn')          renderAllBranchSnapshot();
      else if (tabBtnId === 'allStaffOverallPerformanceTabBtn') renderOverallStaffPerformanceReport();
      else if (tabBtnId === 'nonParticipatingBranchesTabBtn')   renderNonParticipatingBranches();
      else if (tabBtnId === 'branchPerformanceTabBtn')
        reportDisplay.innerHTML = '<p>Select a branch above to view Branch Performance Report.</p>';
    }
  }

  // ─── MONTH FILTER LISTENERS ───────────────────────────────────────────────

  monthSelect.addEventListener('change', () => {
    updateKpiPulseBar();
    const active = document.querySelector('.tab-button.active');
    if (!active) return;
    if      (active.id === 'allBranchSnapshotTabBtn')          renderAllBranchSnapshot();
    else if (active.id === 'allStaffOverallPerformanceTabBtn') renderOverallStaffPerformanceReport();
    else if (active.id === 'nonParticipatingBranchesTabBtn')   renderNonParticipatingBranches();
    else if (active.id === 'branchPerformanceTabBtn' && branchSelect.value) renderBranchPerformanceReport(branchSelect.value);
  });

  analyticsMonthSelect && analyticsMonthSelect.addEventListener('change', () => {
    if (window.renderAnalytics) window.renderAnalytics(allCanvassingData, analyticsMonthSelect.value, TARGETS, H, employeeCodeToNameMap, employeeCodeToDesignationMap, PREDEFINED_BRANCHES, filterDataByMonth, calculateTotalActivity);
  });

  // ─── BRANCH / EMPLOYEE DROPDOWNS ─────────────────────────────────────────

  branchSelect.addEventListener('change', () => {
    const branch = branchSelect.value;
    const monthData = filterDataByMonth(allCanvassingData, monthSelect.value);

    if (branch) {
      employeeFilterPanel.style.display = 'block';
      viewOptions.style.display = 'flex';
      const codes = [...new Set(monthData.filter(e => e[H.BRANCH] === branch).map(e => e[H.EMP_CODE]))]
        .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));
      populateDropdown(employeeSelect, codes, true);
      employeeSelect.value = '';
      selectedEmployeeCodeEntries = [];
      renderBranchPerformanceReport(branch);
    } else {
      employeeFilterPanel.style.display = 'none';
      viewOptions.style.display = 'none';
      reportDisplay.innerHTML = '<p>Select a branch to view reports.</p>';
    }
  });

  employeeSelect.addEventListener('change', () => {
    const code = employeeSelect.value;
    const monthData = filterDataByMonth(allCanvassingData, monthSelect.value);
    if (code) {
      selectedEmployeeCodeEntries = monthData.filter(e => e[H.EMP_CODE] === code && e[H.BRANCH] === branchSelect.value);
      document.querySelectorAll('.view-options .btn').forEach(b => b.classList.remove('active'));
      $('viewEmployeeSummaryBtn').classList.add('active');
      renderEmployeeSummary(selectedEmployeeCodeEntries);
    } else {
      selectedEmployeeCodeEntries = [];
    }
  });

  customerViewMonthSelect.addEventListener('change', () => {
    updateCustomerViewEmployeeDropdown();
  });

  customerViewBranchSelect.addEventListener('change', () => {
    updateCustomerViewEmployeeDropdown();
    const branch = customerViewBranchSelect.value;
    const emp    = customerViewEmployeeSelect.value;
    if (branch && emp) loadDetailedCustomerReport();
    else detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select an employee to load customer data.</td></tr>';
  });

  customerViewEmployeeSelect.addEventListener('change', () => {
    if (customerViewBranchSelect.value && customerViewEmployeeSelect.value) loadDetailedCustomerReport();
  });

  $('loadCustomerDataBtn').addEventListener('click', loadDetailedCustomerReport);

  function updateCustomerViewEmployeeDropdown() {
    const branch = customerViewBranchSelect.value;
    if (!branch) { customerViewEmployeeSelect.innerHTML = '<option value="">-- Select --</option>'; return; }
    const monthData = filterDataByMonth(allCanvassingData, customerViewMonthSelect.value);
    const codes = [...new Set(monthData.filter(e => e[H.BRANCH] === branch).map(e => e[H.EMP_CODE]))]
      .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));
    populateDropdown(customerViewEmployeeSelect, codes, true);
    customerViewEmployeeSelect.value = '';
  }

  // ─── VIEW OPTION BUTTONS ──────────────────────────────────────────────────

  function setActiveViewBtn(id) {
    document.querySelectorAll('.view-options .btn').forEach(b => b.classList.remove('active'));
    $(id) && $(id).classList.add('active');
  }

  $('viewBranchPerformanceReportBtn').addEventListener('click', () => {
    setActiveViewBtn('viewBranchPerformanceReportBtn');
    branchSelect.value ? renderBranchPerformanceReport(branchSelect.value) : showToast('Select a branch first.', 'error');
  });
  $('viewEmployeeSummaryBtn').addEventListener('click', () => {
    setActiveViewBtn('viewEmployeeSummaryBtn');
    employeeSelect.value
      ? renderEmployeeSummary(filterDataByMonth(allCanvassingData, monthSelect.value).filter(e => e[H.EMP_CODE] === employeeSelect.value && e[H.BRANCH] === branchSelect.value))
      : showToast('Select an employee first.', 'error');
  });
  $('viewAllEntriesBtn').addEventListener('click', () => {
    setActiveViewBtn('viewAllEntriesBtn');
    let data = filterDataByMonth(allCanvassingData, monthSelect.value);
    if (branchSelect.value)   data = data.filter(e => e[H.BRANCH]   === branchSelect.value);
    if (employeeSelect.value) data = data.filter(e => e[H.EMP_CODE] === employeeSelect.value);
    renderAllEntries(data);
  });
  $('viewPerformanceReportBtn').addEventListener('click', () => {
    setActiveViewBtn('viewPerformanceReportBtn');
    if (branchSelect.value && employeeSelect.value) {
      renderEmployeeSummary(filterDataByMonth(allCanvassingData, monthSelect.value).filter(e => e[H.EMP_CODE] === employeeSelect.value && e[H.BRANCH] === branchSelect.value));
    } else renderOverallStaffPerformanceReport();
  });
  $('viewBranchVisitLeaderboardBtn').addEventListener('click', () => { setActiveViewBtn('viewBranchVisitLeaderboardBtn'); renderLeaderboard('Visit'); });
  $('viewBranchCallLeaderboardBtn').addEventListener('click', () => { setActiveViewBtn('viewBranchCallLeaderboardBtn'); renderLeaderboard('Call'); });
  $('viewStaffParticipationBtn').addEventListener('click', () => { setActiveViewBtn('viewStaffParticipationBtn'); renderStaffParticipation(); });

  downloadOverallBtn && downloadOverallBtn.addEventListener('click', downloadOverallStaffPerformanceReportCSV);
  $('downloadDetailedCustomerReportBtn').addEventListener('click', downloadDetailedCustomerReportCSV);

  // ─── RENDERERS ────────────────────────────────────────────────────────────

  function renderAllBranchSnapshot() {
    const month = monthSelect.value;
    const data  = filterDataByMonth(allCanvassingData, month);

    let html = '<h2>All Branch Snapshot</h2>';
    html += '<div class="table-container"><table class="all-branch-snapshot-table"><thead><tr>';
    ['Branch Name','Active Staff','Visits','Calls','References','New Leads'].forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';

    PREDEFINED_BRANCHES.forEach(branch => {
      const entries = data.filter(e => e[H.BRANCH] === branch);
      const { totalActivity } = calculateTotalActivity(entries);
      const staffCount = new Set(entries.map(e => e[H.EMP_CODE])).size;
      const rowClass = entries.length === 0 ? 'row-zero' : '';
      html += `<tr class="${rowClass}">
        <td data-label="Branch">${branch}</td>
        <td data-label="Active Staff">${staffCount}</td>
        <td data-label="Visits">${totalActivity['Visit']}</td>
        <td data-label="Calls">${totalActivity['Call']}</td>
        <td data-label="References">${totalActivity['Reference']}</td>
        <td data-label="New Leads">${totalActivity['New Customer Leads']}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    reportDisplay.innerHTML = html;
  }

  function renderNonParticipatingBranches() {
    const data = filterDataByMonth(allCanvassingData, monthSelect.value);
    const zeroBranches = PREDEFINED_BRANCHES.filter(b => {
      const { totalActivity } = calculateTotalActivity(data.filter(e => e[H.BRANCH] === b));
      return totalActivity['Visit'] === 0;
    });
    let html = '<h2>Zero Visit Branches</h2>';
    if (zeroBranches.length) {
      html += `<p>${zeroBranches.length} branch(es) with no visits:</p><ul class="non-participating-branch-list">`;
      zeroBranches.forEach(b => html += `<li>${b}</li>`);
      html += '</ul>';
    } else {
      html += '<p class="no-participation-message">All branches have recorded visits this month.</p>';
    }
    reportDisplay.innerHTML = html;
  }

  function renderOverallStaffPerformanceReport() {
    const data    = filterDataByMonth(allCanvassingData, monthSelect.value);
    const metrics = ['Visit','Call','Reference','New Customer Leads'];

    const employees = [...new Set(data.map(e => e[H.EMP_CODE]))]
      .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

    if (!employees.length) {
      reportDisplay.innerHTML = '<h2>Overall Staff Performance</h2><p>No activity for selected month.</p>';
      return;
    }

    let html = '<h2>Overall Staff Performance</h2><div class="table-container"><table class="performance-table"><thead>';
    html += '<tr><th>Name</th><th>Branch</th><th>Designation</th>';
    metrics.forEach(m => html += `<th colspan="3">${m}</th>`);
    html += '</tr><tr><th></th><th></th><th></th>';
    metrics.forEach(() => { html += '<th>Act</th><th>Tgt</th><th>%</th>'; });
    html += '</tr></thead><tbody>';

    employees.forEach(code => {
      const name   = employeeCodeToNameMap[code] || code;
      const branch = data.find(e => e[H.EMP_CODE] === code)?.[H.BRANCH] || 'N/A';
      const desig  = employeeCodeToDesignationMap[code] || 'Default';
      const entries = data.filter(e => e[H.EMP_CODE] === code);
      const { totalActivity } = calculateTotalActivity(entries);
      const targets = TARGETS[desig] || TARGETS['Default'];
      const perf    = calculatePerformance(totalActivity, targets);

      html += `<tr><td>${name}</td><td>${branch}</td><td>${desig}</td>`;
      metrics.forEach(m => {
        const act = totalActivity[m] || 0;
        const tgt = targets[m]       || 0;
        const pct = perf[m];
        let pctStr = (isNaN(pct) || tgt === 0) ? 'N/A' : `${Math.round(pct)}%`;
        if (act === 0 && tgt > 0) pctStr = '0%';
        const barClass = (isNaN(pct) || tgt === 0) ? 'no-activity' : getProgressBarClass(pct);
        const barW = Math.min(100, isNaN(pct) ? 0 : Math.round(pct));
        html += `<td>${act}</td><td>${tgt}</td>
          <td><div class="progress-bar-container-small">
            <div class="progress-bar ${barClass}" style="width:${barW}%">${pctStr}</div>
          </div></td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    reportDisplay.innerHTML = html;
  }

  function renderBranchPerformanceReport(branchName) {
    const data    = filterDataByMonth(allCanvassingData, monthSelect.value).filter(e => e[H.BRANCH] === branchName);
    const metrics = ['Visit','Call','Reference','New Customer Leads'];

    if (!data.length) {
      reportDisplay.innerHTML = `<h2>Branch Performance: ${branchName}</h2><p>No activity for selected month.</p>`;
      return;
    }

    const employees = [...new Set(data.map(e => e[H.EMP_CODE]))]
      .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

    // Sticky branch totals row
    const branchActivity = calculateTotalActivity(data).totalActivity;
    let html = `<h2>Branch Performance: ${branchName}</h2>`;
    html += '<div class="branch-totals-bar">';
    metrics.forEach(m => html += `<span><strong>${m}:</strong> ${branchActivity[m]}</span>`);
    html += '</div>';
    html += '<div class="table-container"><table class="performance-table"><thead>';
    html += '<tr><th>Employee</th><th>Designation</th>';
    metrics.forEach(m => html += `<th colspan="3">${m}</th>`);
    html += '</tr><tr><th></th><th></th>';
    metrics.forEach(() => html += '<th>Act</th><th>Tgt</th><th>%</th>');
    html += '</tr></thead><tbody>';

    employees.forEach(code => {
      const name  = employeeCodeToNameMap[code]        || code;
      const desig = employeeCodeToDesignationMap[code] || 'Default';
      const entries = data.filter(e => e[H.EMP_CODE] === code);
      const { totalActivity } = calculateTotalActivity(entries);
      const targets = TARGETS[desig] || TARGETS['Default'];
      const perf    = calculatePerformance(totalActivity, targets);

      html += `<tr><td>${name}</td><td>${desig}</td>`;
      metrics.forEach(m => {
        const act = totalActivity[m] || 0;
        const tgt = targets[m]       || 0;
        const pct = perf[m];
        let pctStr = (isNaN(pct)||tgt===0) ? 'N/A' : `${Math.round(pct)}%`;
        if (act===0 && tgt>0) pctStr = '0%';
        const barClass = (isNaN(pct)||tgt===0) ? 'no-activity' : getProgressBarClass(pct);
        const barW = Math.min(100, isNaN(pct) ? 0 : Math.round(pct));
        html += `<td>${act}</td><td>${tgt}</td>
          <td><div class="progress-bar-container-small">
            <div class="progress-bar ${barClass}" style="width:${barW}%">${pctStr}</div>
          </div></td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    reportDisplay.innerHTML = html;
  }

  function renderEmployeeSummary(entries) {
    if (!entries.length) {
      reportDisplay.innerHTML = '<p>No entries for this employee in the selected period.</p>';
      return;
    }
    const code   = entries[0][H.EMP_CODE];
    const name   = employeeCodeToNameMap[code]        || code;
    const branch = entries[0][H.BRANCH];
    const desig  = employeeCodeToDesignationMap[code] || 'Default';
    const { totalActivity, productInterests } = calculateTotalActivity(entries);
    const targets = TARGETS[desig] || TARGETS['Default'];
    const perf    = calculatePerformance(totalActivity, targets);
    const metrics = ['Visit','Call','Reference','New Customer Leads'];

    // Run-rate projection
    const now = new Date();
    const dayElapsed = now.getDate();
    const projections = {};
    metrics.forEach(m => {
      const daily = dayElapsed > 0 ? totalActivity[m] / dayElapsed : 0;
      projections[m] = Math.round(daily * MONTHLY_WORKING_DAYS);
    });

    let html = `
      <div class="employee-summary-header">
        <div><strong>${name}</strong> &nbsp; <span class="tag">${desig}</span></div>
        <div class="summary-meta">${branch} &nbsp;|&nbsp; ${entries.length} entries</div>
      </div>
      <table class="summary-metrics-table"><thead>
        <tr><th>Metric</th><th>Actual</th><th>Target</th><th>% Done</th><th>Projected</th></tr>
      </thead><tbody>`;

    metrics.forEach(m => {
      const act  = totalActivity[m] || 0;
      const tgt  = targets[m]       || 0;
      const pct  = perf[m];
      const proj = projections[m];
      const pctStr = (isNaN(pct)||tgt===0) ? 'N/A' : `${Math.round(pct)}%`;
      const barClass = (isNaN(pct)||tgt===0) ? 'no-activity' : getProgressBarClass(pct);
      const barW = Math.min(100, isNaN(pct) ? 0 : Math.round(pct));
      const projClass = proj >= tgt ? 'proj-good' : 'proj-risk';
      html += `<tr>
        <td>${m}</td>
        <td>${act}</td>
        <td>${tgt}</td>
        <td><div class="progress-bar-container-small">
          <div class="progress-bar ${barClass}" style="width:${barW}%">${pctStr}</div>
        </div></td>
        <td class="${projClass}">${proj >= tgt ? '✓' : '⚠'} ${proj}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    if (productInterests.length) html += `<p class="product-tags"><strong>Products:</strong> ${productInterests.map(p=>`<span class="tag">${p}</span>`).join(' ')}</p>`;
    html += `<button class="btn download-btn" id="downloadEmployeeSummaryCSV" data-employee-code="${code}">⬇ Download Summary CSV</button>`;

    reportDisplay.innerHTML = html;
    $('downloadEmployeeSummaryCSV').addEventListener('click', e => downloadEmployeeSummaryCSV(e.target.dataset.employeeCode));
  }

  function renderAllEntries(entries, title='All Canvassing Entries') {
    if (!entries.length) { reportDisplay.innerHTML = `<h2>${title}</h2><p>No entries found.</p>`; return; }
    const headers = Object.keys(entries[0]);
    let html = `<h2>${title}</h2><div class="table-container"><table class="data-table"><thead><tr>`;
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    entries.forEach(entry => {
      html += '<tr>';
      headers.forEach(h => {
        let val = entry[h];
        if (currentAccessLevel === 'limited_data_view') {
          if (h === H.PHONE)   val = maskPhone(val);
          if (h === H.ADDRESS) val = maskAddress(val);
        }
        html += `<td data-label="${h}">${val || ''}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    reportDisplay.innerHTML = html;
  }

  function renderLeaderboard(metricType) {
    const data = filterDataByMonth(allCanvassingData, monthSelect.value);
    const totals = {};
    data.forEach(e => {
      const type = (e[H.ACTIVITY_TYPE]||'').trim().toLowerCase();
      const norm = type === 'visit' ? 'Visit' : type === 'calls' ? 'Call' : null;
      if (norm === metricType) totals[e[H.BRANCH]] = (totals[e[H.BRANCH]]||0) + 1;
    });
    const sorted = Object.entries(totals).sort(([,a],[,b]) => b-a);

    let html = `<h2>Branch ${metricType} Leaderboard</h2>`;
    if (!sorted.length) { html += `<p>No ${metricType} activity recorded.</p>`; reportDisplay.innerHTML = html; return; }
    html += '<table class="leaderboard-table"><thead><tr><th>Rank</th><th>Branch</th><th>Total</th></tr></thead><tbody>';
    sorted.forEach(([branch, count], i) => {
      const medal = i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : '';
      html += `<tr><td>${medal} ${i+1}</td><td>${branch}</td><td>${count}</td></tr>`;
    });
    html += '</tbody></table>';
    reportDisplay.innerHTML = html;
  }

  function renderStaffParticipation() {
    const data = filterDataByMonth(allCanvassingData, monthSelect.value);
    const activeCodes = new Set(data.map(e => e[H.EMP_CODE]));
    const rows = allUniqueEmployees.map(code => ({
      name:        employeeCodeToNameMap[code]        || code,
      branch:      (allCanvassingData.find(e => e[H.EMP_CODE] === code)||{})[H.BRANCH] || 'N/A',
      designation: employeeCodeToDesignationMap[code] || 'Default',
      active:      activeCodes.has(code)
    })).sort((a,b) => a.name.localeCompare(b.name));

    let html = '<h2>Staff Participation</h2><table class="data-table"><thead><tr><th>Name</th><th>Branch</th><th>Designation</th><th>Participated</th></tr></thead><tbody>';
    rows.forEach(r => {
      html += `<tr>
        <td>${r.name}</td><td>${r.branch}</td><td>${r.designation}</td>
        <td class="${r.active ? 'status-yes' : 'status-no'}">${r.active ? '✓ Yes' : '✗ No'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    reportDisplay.innerHTML = html;
  }

  // ─── CUSTOMER VIEW ────────────────────────────────────────────────────────

  function loadDetailedCustomerReport() {
    const branch = customerViewBranchSelect.value;
    const code   = customerViewEmployeeSelect.value;
    const month  = customerViewMonthSelect.value;
    if (!branch || !code || !month) {
      detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select Branch, Employee and Month.</td></tr>';
      return;
    }
    const entries = filterDataByMonth(allCanvassingData, month)
      .filter(e => e[H.BRANCH] === branch && e[H.EMP_CODE] === code && (e[H.PROSPECT_NAME]||'').trim());

    detailedCustomerReportTableBody.innerHTML = '';
    if (!entries.length) {
      detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">No customer entries found.</td></tr>';
      customerDetailsContent.style.display = 'none';
      return;
    }

    entries.forEach(entry => {
      const row = detailedCustomerReportTableBody.insertRow();
      const phone = (currentAccessLevel === 'limited_data_view') ? maskPhone(entry[H.PHONE]) : (entry[H.PHONE]||'N/A');
      row.insertCell().textContent = entry[H.PROSPECT_NAME] || 'N/A';
      row.insertCell().textContent = phone;
      row.insertCell().textContent = entry[H.ACTIVITY_TYPE] || 'N/A';
      row.insertCell().textContent = formatDate(entry[H.TIMESTAMP]);
      const btn = document.createElement('button');
      btn.textContent = 'View';
      btn.className = 'btn-small';
      btn.onclick = () => showCustomerDetails(entry);
      row.insertCell().appendChild(btn);
    });
    customerDetailsContent.style.display = 'none';
  }

  function showCustomerDetails(entry) {
    const phone   = (currentAccessLevel === 'limited_data_view') ? maskPhone(entry[H.PHONE])    : (entry[H.PHONE]   ||'N/A');
    const address = (currentAccessLevel === 'limited_data_view') ? maskAddress(entry[H.ADDRESS]) : (entry[H.ADDRESS] ||'N/A');

    $('currentCustomerName').textContent  = entry[H.PROSPECT_NAME] || 'N/A';
    $('employeeNameValue').textContent    = entry[H.EMP_NAME]      || 'N/A';
    $('branchNameValue').textContent      = entry[H.BRANCH]        || 'N/A';

    customerCard1.innerHTML = `<h4>Contact & Basic Info</h4>
      ${dr('Prospect Name', entry[H.PROSPECT_NAME])}
      ${dr('Phone', phone)}${dr('Address', address)}
      ${dr('Profession', entry[H.PROFESSION])}
      ${dr('Monthly Income', entry[H.MONTHLY_INCOME])}
      ${dr('DOB/WD', formatDate(entry[H.DOB]))}`;

    customerCard2.innerHTML = `<h4>Activity & Interests</h4>
      ${dr('Activity Type', entry[H.ACTIVITY_TYPE])}
      ${dr('Customer Type', entry[H.CUSTOMER_TYPE])}
      ${dr('Lead Source', entry[H.LEAD_SOURCE])}
      ${dr('How Contacted', entry[H.HOW_CONTACTED])}
      ${dr('Product Interested', entry[H.PRODUCT])}
      ${dr('Remarks', entry[H.REMARKS])}
      ${dr('Next Follow-up', formatDate(entry[H.FOLLOWUP_DATE]))}`;

    customerCard3.innerHTML = `<h4>Family & Profile</h4>
      ${dr('Relation with Staff', entry[H.RELATION])}
      ${dr('Wife/Husband Name', entry[H.FAMILY_1])}
      ${dr('Wife/Husband Job', entry[H.FAMILY_2])}
      ${dr('Children Names', entry[H.FAMILY_3])}
      ${dr('Children Details', entry[H.FAMILY_4])}
      ${dr('Status of Lead', entry[H.PROFILE])}`;

    customerDetailsContent.style.display = 'grid';
  }

  const dr = (label, val) => `<div class="detail-row"><div class="detail-label">${label}:</div><div class="detail-value">${val||'N/A'}</div></div>`;

  // ─── DOWNLOADS ────────────────────────────────────────────────────────────

  function downloadOverallStaffPerformanceReportCSV() {
    const data    = filterDataByMonth(allCanvassingData, monthSelect.value);
    const metrics = ['Visit','Call','Reference','New Customer Leads'];
    const employees = [...new Set(data.map(e => e[H.EMP_CODE]))]
      .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

    if (!employees.length) { showToast('No data for selected month.', 'info'); return; }

    const rows = [['Employee Name','Branch','Employee Code',...metrics.flatMap(m => [`${m} Actual`,`${m} Target`,`${m} %`])]];
    employees.forEach(code => {
      const entries = data.filter(e => e[H.EMP_CODE] === code);
      const { totalActivity } = calculateTotalActivity(entries);
      const desig   = employeeCodeToDesignationMap[code] || 'Default';
      const targets = TARGETS[desig] || TARGETS['Default'];
      const perf    = calculatePerformance(totalActivity, targets);
      const branch  = entries[0]?.[H.BRANCH] || 'N/A';
      const row = [employeeCodeToNameMap[code]||code, branch, code];
      metrics.forEach(m => {
        const act = totalActivity[m]||0, tgt = targets[m]||0;
        const pct = perf[m];
        row.push(act, tgt, (isNaN(pct)||tgt===0) ? 'N/A' : `${Math.round(pct)}%`);
      });
      rows.push(row);
    });
    downloadCSV(rows, 'Overall_Staff_Performance.csv');
  }

  function downloadEmployeeSummaryCSV(code) {
    const data    = filterDataByMonth(allCanvassingData, monthSelect.value).filter(e => e[H.EMP_CODE] === code && e[H.BRANCH] === branchSelect.value);
    const name    = employeeCodeToNameMap[code] || code;
    const desig   = employeeCodeToDesignationMap[code] || 'Default';
    const targets = TARGETS[desig] || TARGETS['Default'];
    const { totalActivity, productInterests } = calculateTotalActivity(data);
    const perf    = calculatePerformance(totalActivity, targets);

    const rows = [
      ['Employee', name], ['Code', code], ['Branch', branchSelect.value], ['Designation', desig],
      [], ['Metric','Actual','Target','%'],
      ...Object.keys(targets).map(m => [m, totalActivity[m]||0, targets[m], (isNaN(perf[m])||targets[m]===0)?'N/A':`${Math.round(perf[m])}%`]),
      [], ['Product Interests', productInterests.join(', ')||'None']
    ];
    downloadCSV(rows, `${name.replace(/\s+/g,'_')}_Summary.csv`);
  }

  function downloadDetailedCustomerReportCSV() {
    const branch = customerViewBranchSelect.value;
    const code   = customerViewEmployeeSelect.value;
    const month  = customerViewMonthSelect.value;
    const entries = filterDataByMonth(allCanvassingData, month).filter(e => e[H.BRANCH]===branch && e[H.EMP_CODE]===code);
    if (!entries.length) { showToast('No data to download.', 'info'); return; }

    const headers = Object.keys(entries[0]);
    const rows = [headers, ...entries.map(e => headers.map(h => {
      let v = e[h];
      if (currentAccessLevel === 'limited_data_view') {
        if (h===H.PHONE)   v = maskPhone(v);
        if (h===H.ADDRESS) v = maskAddress(v);
      }
      return v||'';
    }))];
    downloadCSV(rows, `Customer_Report_${branch}_${month}.csv`);
  }

  function downloadCSV(rows, filename) {
    const csv  = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename, style:'visibility:hidden' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${filename} downloaded.`, 'success');
  }

  // ─── EMPLOYEE MANAGEMENT ─────────────────────────────────────────────────

  async function sendToGAS(action, data) {
    displayEmployeeManagementMessage('Processing...', false);
    try {
      const res  = await fetch(WEB_APP_URL, { method:'POST', mode:'cors', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action, data}) });
      const json = await res.json();
      if (json.status === 'SUCCESS') {
        displayEmployeeManagementMessage(json.message || 'Done!', false);
        await processData(true);
        return true;
      } else {
        displayEmployeeManagementMessage(json.message || 'Operation failed.', true);
        return false;
      }
    } catch (err) {
      displayEmployeeManagementMessage(`Error: ${err.message}`, true);
      return false;
    }
  }

  addEmployeeForm && addEmployeeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { [H.EMP_NAME]: $('newEmployeeName').value.trim(), [H.EMP_CODE]: $('newEmployeeCode').value.trim(), [H.BRANCH]: newBranchNameInput.value, [H.DESIGNATION]: $('newDesignation').value.trim() };
    if (await sendToGAS('add_employee', data)) addEmployeeForm.reset();
  });

  bulkAddEmployeeForm && bulkAddEmployeeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const branch = bulkEmployeeBranchNameInput.value;
    const employees = $('bulkEmployeeDetails').value.trim().split('\n')
      .map(line => { const [name,code,desig] = line.split(',').map(s=>s.trim()); return name&&code&&desig ? {[H.EMP_NAME]:name,[H.EMP_CODE]:code,[H.DESIGNATION]:desig,[H.BRANCH]:branch} : null; })
      .filter(Boolean);
    if (!employees.length) { displayEmployeeManagementMessage('No valid data found.', true); return; }
    if (await sendToGAS('bulk_add_employees', { employees })) bulkAddEmployeeForm.reset();
  });

  deleteEmployeeForm && deleteEmployeeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const code = deleteEmployeeCodeInput.value.trim();
    if (await sendToGAS('delete_employee', { [H.EMP_CODE]: code })) deleteEmployeeForm.reset();
  });

  // ─── UTILITIES ────────────────────────────────────────────────────────────

  function populateDropdown(el, items, useCodeForValue = false) {
    el.innerHTML = '<option value="">-- Select --</option>';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = useCodeForValue ? (employeeCodeToNameMap[item] || item) : item;
      el.appendChild(opt);
    });
  }

  function populateMonthDropdowns() {
    [monthSelect, customerViewMonthSelect].forEach(el => populateMonthDropdownSingle(el));
  }

  function populateMonthDropdownSingle(el) {
    if (!el) return;
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const now = new Date();
    const cy = now.getFullYear(), cm = now.getMonth();
    const prev = cy - 1;
    el.innerHTML = '<option value="">-- Select Month --</option>';
    [prev, cy].forEach(yr => {
      months.forEach((mn, i) => {
        const opt = document.createElement('option');
        opt.value = `${i+1}-${yr}`;
        opt.textContent = `${mn} ${yr}`;
        el.appendChild(opt);
      });
    });
    el.value = `${cm+1}-${cy}`;
  }

  const formatDate = str => {
    if (!str) return '';
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
  };

  const maskPhone   = p => (!p || p.length <= 4) ? '***' : '***' + p.slice(-4);
  const maskAddress = a => a ? a.replace(/./g, '*') : 'N/A';

  function displayEmployeeManagementMessage(msg, isError) {
    if (!employeeManagementMessage) return;
    employeeManagementMessage.textContent = msg;
    employeeManagementMessage.style.color = isError ? 'red' : 'green';
    employeeManagementMessage.style.display = 'block';
    setTimeout(() => { employeeManagementMessage.style.display = 'none'; }, 5000);
  }

  // Toast notifications — replaces old statusMessage div (which doesn't exist in modal scope)
  function showToast(msg, type='info') {
    let t = $('eet-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'eet-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = `eet-toast ${type}`;
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, 4000);
  }

  // Expose for analytics.js
  window._eetCore = { filterDataByMonth, calculateTotalActivity, TARGETS, H, PREDEFINED_BRANCHES, formatDate };

}); // end DOMContentLoaded
