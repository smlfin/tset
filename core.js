/**
 * EET — core.js  (replaces script.js + tabhandler.js)
 *
 * Bugs fixed vs original:
 *   1. processData() only fires AFTER successful login — not on page load
 *   2. Duplicate detailedCustomerViewTabBtn listener removed
 *   3. maskPhoneNumber / maskAddress declared once (not 3× in original)
 *   4. All console.log debug spam removed from calculateTotalActivity
 *   5. nonParticipantReport tab now receives selected month value
 *   6. sessionStorage caching (5-min TTL) — no redundant CSV fetches on tab switch
 *   7. Tab routing unified into activateTab() — tabhandler.js no longer needed
 *   8. Customer View fully wired: branch→employee→load→detail cards all working
 */
document.addEventListener('DOMContentLoaded', () => {

/* ─── CONFIG ─────────────────────────────────────────────────────────────── */
const ACCESS_PASSWORD_FULL         = "1";
const ACCESS_PASSWORD_LIMITED      = "123";
const ACCESS_PASSWORD_LIMITED_DATA = "sml4576";

const DATA_URL    = "https://docs.google.com/spreadsheets/d/1Za1CrlzzXpQjB3yZHjL2ZpRkjXgkVmLHH_LtXJq9K5o/export?format=csv&gid=696550092";
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxe_hZyRXZdY1CbfchvH_pzIa596dxmEDnPVc4YGXWerxRmuJz30CpEbND279mR0lWf/exec";
const CACHE_KEY   = 'eet_canvassing_v1';
const CACHE_TTL   = 5 * 60 * 1000;  // 5 minutes

const MONTHLY_WORKING_DAYS = 25;
const TARGETS = {
  'Branch Manager':   { Visit: 10, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 },
  'Investment Staff': { Visit: 15, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 },
  'Seniors':          { Visit: 15, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 },
  'Default':          { Visit:  5, Call: 2*MONTHLY_WORKING_DAYS, Reference: 1*MONTHLY_WORKING_DAYS, 'New Customer Leads': 20 }
};

const PREDEFINED_BRANCHES = [
  "Angamaly","Corporate Office","Edappally","Harippad","Koduvayur","Kuzhalmannam",
  "Mattanchery","Mavelikara","Nedumkandom","Nenmara","Paravoor","Perumbavoor",
  "Thiruwillamala","Thodupuzha","Chengannur","Alathur","Kottayam","Kattapana",
  "Muvattupuzha","Thiruvalla","Pathanamthitta","Kunnamkulam","HO KKM"
].sort();

// Column header constants — typos preserved to match Google Sheet exactly
const H_TIMESTAMP      = 'Timestamp';
const H_DATE           = 'Date';
const H_BRANCH         = 'Branch Name';
const H_EMP_NAME       = 'Employee Name';
const H_EMP_CODE       = 'Employee Code';
const H_DESIGNATION    = 'Designation';
const H_ACTIVITY_TYPE  = 'Activity Type';
const H_CUSTOMER_TYPE  = 'Type of Customer';
const H_LEAD_SOURCE    = 'rLead Source';
const H_HOW_CONTACTED  = 'How Contacted';
const H_PROSPECT_NAME  = 'Prospect Name';
const H_PHONE          = 'Phone Numebr(Whatsapp)';  // typo in sheet preserved
const H_ADDRESS        = 'Address';
const H_PROFESSION     = 'Profession';
const H_DOB            = 'DOB/WD';
const H_PRODUCT        = 'Prodcut Interested';       // typo in sheet preserved
const H_REMARKS        = 'Remarks';
const H_FOLLOWUP_DATE  = 'Next Follow-up Date';
const H_RELATION       = 'Relation With Staff';
const H_FAMILY_1       = 'Family Deatils -1 Name of wife/Husband';
const H_FAMILY_2       = 'Family Deatils -2 Job of wife/Husband';
const H_FAMILY_3       = 'Family Deatils -3 Names of Children';
const H_FAMILY_4       = 'Family Deatils -4 Deatils of Children';
const H_PROFILE        = 'Profile of Customer';
const H_INCOME         = 'Average Monthly Income';

/* ─── STATE ──────────────────────────────────────────────────────────────── */
let currentAccessLevel           = null;
let allCanvassingData            = [];
let allUniqueBranches            = [];
let allUniqueEmployees           = [];
let employeeCodeToNameMap        = {};
let employeeCodeToDesignationMap = {};
let selectedEmployeeCodeEntries  = [];

/* ─── DOM REFS ───────────────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const el = (tag, attrs = {}, text = '') => {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  if (text) e.textContent = text;
  return e;
};

// Auth
const accessDeniedOverlay   = $('accessDeniedOverlay');
const dashboardContent      = $('dashboardContent');
const secretPasswordInput   = $('secretPasswordInput');
const submitBtn             = $('submitSecretPassword');
const passwordErrorMessage  = $('passwordErrorMessage');

// Report controls
const reportDisplay         = $('reportDisplay');
const branchSelect          = $('branchSelect');
const employeeSelect        = $('employeeSelect');
const employeeFilterPanel   = $('employeeFilterPanel');
const monthSelect           = $('monthSelect');
const viewOptions           = $('viewOptions');
const analyticsMonthSelect  = $('analyticsMonthSelect');

// Customer View
const customerViewBranchSelect        = $('customerViewBranchSelect');
const customerViewEmployeeSelect      = $('customerViewEmployeeSelect');
const customerViewMonthSelect         = $('customerViewMonthSelect');
const detailedCustomerReportTableBody = $('detailedCustomerReportTableBody');
const customerDetailsContent          = $('customerDetailsContent');
const statusMessage                   = $('statusMessage');
const customerCard1                   = $('customerCard1');
const customerCard2                   = $('customerCard2');
const customerCard3                   = $('customerCard3');

// Employee Management
const addEmployeeForm             = $('addEmployeeForm');
const bulkAddEmployeeForm         = $('bulkAddEmployeeForm');
const deleteEmployeeForm          = $('deleteEmployeeForm');
const employeeManagementMessage   = $('employeeManagementMessage');
const newBranchNameInput          = $('newBranchName');
const bulkEmployeeBranchNameInput = $('bulkEmployeeBranchName');
const deleteEmployeeCodeInput     = $('deleteEmployeeCode');

// Download / misc
const downloadOverallBtn         = $('downloadOverallStaffPerformanceReportBtn');
const downloadDetailedCustomerBtn = $('downloadDetailedCustomerReportBtn');
const detailedCustomerViewTabBtn = $('detailedCustomerViewTabBtn');
const viewAllEntriesBtn          = $('viewAllEntriesBtn');
const lastLoadedLabel            = $('lastLoadedLabel');
const refreshDataBtn             = $('refreshDataBtn');

secretPasswordInput && secretPasswordInput.focus();

/* ─── AUTH ───────────────────────────────────────────────────────────────── */
submitBtn.addEventListener('click', checkAndSetAccess);
secretPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') checkAndSetAccess(); });

function checkAndSetAccess() {
  const pw = secretPasswordInput.value;
  if      (pw === ACCESS_PASSWORD_FULL)         { currentAccessLevel = 'full';             grantAccess(); }
  else if (pw === ACCESS_PASSWORD_LIMITED)      { currentAccessLevel = 'limited';          grantAccess(); }
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
  dashboardContent.style.display    = 'block';
  applyAccessRestrictions();
  processData();                         // ← only called here, after login
  activateTab('allBranchSnapshotTabBtn');
}

function applyAccessRestrictions() {
  const limited = currentAccessLevel === 'limited';
  if (downloadOverallBtn)         downloadOverallBtn.style.display         = limited ? 'none' : 'inline-block';
  if (detailedCustomerViewTabBtn) detailedCustomerViewTabBtn.style.display = limited ? 'none' : 'inline-block';
  if (viewAllEntriesBtn)          viewAllEntriesBtn.style.display          = limited ? 'none' : 'inline-block';
}

/* ─── DATA LAYER ─────────────────────────────────────────────────────────── */
async function processData(forceRefresh = false) {
  await fetchCanvassingData(forceRefresh);

  allUniqueBranches = [...PREDEFINED_BRANCHES];
  employeeCodeToNameMap        = {};
  employeeCodeToDesignationMap = {};

  allCanvassingData.forEach(e => {
    if (e[H_EMP_CODE]) {
      employeeCodeToNameMap[e[H_EMP_CODE]]        = e[H_EMP_NAME]    || e[H_EMP_CODE];
      employeeCodeToDesignationMap[e[H_EMP_CODE]] = e[H_DESIGNATION] || 'Default';
    }
  });

  allUniqueEmployees = [...new Set(allCanvassingData.map(e => e[H_EMP_CODE]))]
    .sort((a, b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

  // Expose for nonparticipantsreport.js
  window.allCanvassingData         = allCanvassingData;
  window.employeeCodeToNameMap     = employeeCodeToNameMap;
  window.HEADER_EMP_CODE           = H_EMP_CODE;
  window.HEADER_ACTIVITY_TYPE      = H_ACTIVITY_TYPE;

  populateDropdown(branchSelect, allUniqueBranches);
  populateDropdown(customerViewBranchSelect, allUniqueBranches);
  populateMonthDropdowns();
  updateKpiPulseBar();
  renderAllBranchSnapshot();
}

async function fetchCanvassingData(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          allCanvassingData = data;
          updateLastLoaded(new Date(ts));
          return;
        }
      }
    } catch (_) { /* cache miss */ }
  }
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allCanvassingData = parseCSV(await res.text());
    const now = Date.now();
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: now, data: allCanvassingData }));
    updateLastLoaded(new Date(now));
  } catch (err) {
    showToast(`Data fetch failed: ${err.message}`, 'error');
    allCanvassingData = allCanvassingData.length ? allCanvassingData : [];
  }
}

refreshDataBtn && refreshDataBtn.addEventListener('click', () => processData(true));

function updateLastLoaded(date) {
  if (lastLoadedLabel) lastLoadedLabel.textContent = `Updated ${date.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;
}

/* ─── CSV PARSER ─────────────────────────────────────────────────────────── */
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
    if (char === '"')            inQuote = !inQuote;
    else if (char === ',' && !inQuote) { result.push(field.trim()); field = ''; }
    else                         field += char;
  }
  result.push(field.trim());
  return result;
}

/* ─── MONTH FILTER ───────────────────────────────────────────────────────── */
function filterDataByMonth(data, selectedMonthValue) {
  if (!selectedMonthValue) return data;
  const [mStr, yStr] = selectedMonthValue.split('-');
  const selMonth = parseInt(mStr) - 1;
  const selYear  = parseInt(yStr);
  return data.filter(entry => {
    const d = new Date(entry[H_TIMESTAMP]);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === selMonth && d.getFullYear() === selYear;
  });
}

/* ─── KPI PULSE BAR ─────────────────────────────────────────────────────── */
function updateKpiPulseBar() {
  const data = filterDataByMonth(allCanvassingData, monthSelect.value);
  const { totalActivity } = calculateTotalActivity(data);
  const activeBranches = new Set(data.map(e => e[H_BRANCH])).size;
  const activeStaff    = new Set(data.map(e => e[H_EMP_CODE])).size;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const monthPct = Math.round((now.getDate() / daysInMonth) * 100);

  const setKpi = (id, val) => { const e = $(id); if (e) e.querySelector('.kpi-val').textContent = val; };
  setKpi('kpiTotalVisits',    totalActivity['Visit']);
  setKpi('kpiTotalCalls',     totalActivity['Call']);
  setKpi('kpiTotalLeads',     totalActivity['New Customer Leads']);
  setKpi('kpiActiveBranches', activeBranches);
  setKpi('kpiActiveStaff',    activeStaff);
  setKpi('kpiMonthProgress',  `${monthPct}%`);
}

/* ─── ACTIVITY CALCULATION ───────────────────────────────────────────────── */
// console.log spam removed — was firing per-entry on every render in original
function calculateTotalActivity(entries) {
  const totalActivity = { Visit: 0, Call: 0, Reference: 0, 'New Customer Leads': 0 };
  const productInterests = new Set();

  entries.forEach(entry => {
    const type     = (entry[H_ACTIVITY_TYPE]  || '').trim().toLowerCase();
    const custType = (entry[H_CUSTOMER_TYPE]  || '').trim().toLowerCase();
    const product  = (entry[H_PRODUCT]        || '').trim();

    if      (type === 'visit')    totalActivity['Visit']++;
    else if (type === 'calls')    totalActivity['Call']++;
    else if (type === 'referance') totalActivity['Reference']++;

    if (custType === 'new') totalActivity['New Customer Leads']++;
    if (product)            productInterests.add(product);
  });

  return { totalActivity, productInterests: [...productInterests] };
}

function calculatePerformance(actuals, targets) {
  const perf = {};
  for (const m in targets) perf[m] = targets[m] > 0 ? (actuals[m]||0) / targets[m] * 100 : NaN;
  return perf;
}

function getProgressBarClass(pct) {
  if (pct >= 100) return 'success';
  if (pct >= 75)  return 'warning-high';
  if (pct >= 50)  return 'warning-medium';
  if (pct > 0)    return 'warning-low';
  return 'danger';
}

/* ─── TAB ROUTING ────────────────────────────────────────────────────────── */
document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.id));
});

// Modal close buttons
$('closeCustomerModalBtn') && $('closeCustomerModalBtn').addEventListener('click', () => {
  $('customerDetailsModal').style.display = 'none';
});
$('closeJulyDashboardModalBtn') && $('closeJulyDashboardModalBtn').addEventListener('click', () => {
  $('julyDashboardModal').style.display = 'none';
});
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});

function activateTab(tabBtnId) {
  // Hide all sections and modals
  document.querySelectorAll('.report-section').forEach(s => s.style.display = 'none');
  $('customerDetailsModal').style.display = 'none';
  $('julyDashboardModal').style.display   = 'none';

  // Update active button
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
  const activeBtn = $(tabBtnId);
  if (activeBtn) activeBtn.classList.add('active');

  if (tabBtnId === 'detailedCustomerViewTabBtn') {
    // ── Customer View Modal ──────────────────────────────────────────────────
    $('customerDetailsModal').style.display = 'flex';
    $('detailedCustomerViewSection').style.display = 'block';
    // Populate dropdowns fresh on modal open
    populateMonthDropdownSingle(customerViewMonthSelect);
    populateDropdown(customerViewBranchSelect, allUniqueBranches);
    updateCustomerViewEmployeeDropdown();

  } else if (tabBtnId === 'julyDashboardTabBtn') {
    // ── July Dashboard Modal ─────────────────────────────────────────────────
    $('julyDashboardModal').style.display = 'flex';
    $('julyDashboardSection').style.display = 'block';
    if (window.loadJulyDashboardData) window.loadJulyDashboardData();

  } else if (tabBtnId === 'analyticsTabBtn') {
    // ── Analytics ────────────────────────────────────────────────────────────
    $('analyticsSection').style.display = 'block';
    populateMonthDropdownSingle(analyticsMonthSelect);
    triggerAnalytics();

  } else if (tabBtnId === 'nonParticipantReportTabBtn') {
    // ── Non-Participant Report ───────────────────────────────────────────────
    $('nonParticipantReportSection').style.display = 'block';
    window._eetSelectedMonth = monthSelect.value;  // pass current month filter
    if (window.generateAndDisplayNonParticipantsReport) {
      window.generateAndDisplayNonParticipantsReport();
    }

  } else if (tabBtnId === 'employeeManagementTabBtn') {
    // ── Employee Management ──────────────────────────────────────────────────
    $('employeeManagementSection').style.display = 'block';
    populateDropdown(newBranchNameInput, PREDEFINED_BRANCHES);
    populateDropdown(bulkEmployeeBranchNameInput, PREDEFINED_BRANCHES);

  } else {
    // ── All report tabs share #reportsSection ────────────────────────────────
    $('reportsSection').style.display = 'block';
    branchSelect.value = '';
    employeeSelect.innerHTML = '<option value="">-- Select --</option>';
    employeeFilterPanel.style.display = 'none';
    viewOptions.style.display         = 'none';
    populateMonthDropdowns();

    if      (tabBtnId === 'allBranchSnapshotTabBtn')           renderAllBranchSnapshot();
    else if (tabBtnId === 'allStaffOverallPerformanceTabBtn')  renderOverallStaffPerformanceReport();
    else if (tabBtnId === 'nonParticipatingBranchesTabBtn')    renderNonParticipatingBranches();
    else if (tabBtnId === 'branchPerformanceTabBtn')
      reportDisplay.innerHTML = '<p>Select a branch above to view the Branch Performance Report.</p>';
  }
}

function triggerAnalytics() {
  if (window.renderAnalytics) {
    window.renderAnalytics(
      allCanvassingData, analyticsMonthSelect.value,
      TARGETS, { BRANCH: H_BRANCH, EMP_CODE: H_EMP_CODE, EMP_NAME: H_EMP_NAME,
        ACTIVITY_TYPE: H_ACTIVITY_TYPE, CUSTOMER_TYPE: H_CUSTOMER_TYPE,
        PRODUCT: H_PRODUCT, PHONE: H_PHONE, LEAD_SOURCE: H_LEAD_SOURCE,
        FOLLOWUP_DATE: H_FOLLOWUP_DATE, PROSPECT_NAME: H_PROSPECT_NAME,
        TIMESTAMP: H_TIMESTAMP },
      employeeCodeToNameMap, employeeCodeToDesignationMap,
      PREDEFINED_BRANCHES, filterDataByMonth, calculateTotalActivity
    );
  }
}

/* ─── MONTH DROPDOWN CHANGE LISTENERS ───────────────────────────────────── */
monthSelect.addEventListener('change', () => {
  updateKpiPulseBar();
  const active = document.querySelector('.tab-button.active');
  if (!active) return;
  const id = active.id;
  if      (id === 'allBranchSnapshotTabBtn')          renderAllBranchSnapshot();
  else if (id === 'allStaffOverallPerformanceTabBtn') renderOverallStaffPerformanceReport();
  else if (id === 'nonParticipatingBranchesTabBtn')   renderNonParticipatingBranches();
  else if (id === 'branchPerformanceTabBtn' && branchSelect.value)
    renderBranchPerformanceReport(branchSelect.value);
});

analyticsMonthSelect && analyticsMonthSelect.addEventListener('change', triggerAnalytics);

/* ─── BRANCH / EMPLOYEE FILTER LISTENERS ────────────────────────────────── */
branchSelect.addEventListener('change', () => {
  const branch    = branchSelect.value;
  const monthData = filterDataByMonth(allCanvassingData, monthSelect.value);

  if (branch) {
    employeeFilterPanel.style.display = 'block';
    viewOptions.style.display         = 'flex';
    const codes = [...new Set(monthData.filter(e => e[H_BRANCH] === branch).map(e => e[H_EMP_CODE]))]
      .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));
    populateDropdown(employeeSelect, codes, true);
    employeeSelect.value = '';
    selectedEmployeeCodeEntries = [];
    document.querySelectorAll('.view-options .btn').forEach(b => b.classList.remove('active'));
    renderBranchPerformanceReport(branch);
  } else {
    employeeFilterPanel.style.display = 'none';
    viewOptions.style.display         = 'none';
    reportDisplay.innerHTML = '<p>Please select a branch from the dropdown above to view reports.</p>';
  }
});

employeeSelect.addEventListener('change', () => {
  const code      = employeeSelect.value;
  const monthData = filterDataByMonth(allCanvassingData, monthSelect.value);
  if (code) {
    selectedEmployeeCodeEntries = monthData.filter(
      e => e[H_EMP_CODE] === code && e[H_BRANCH] === branchSelect.value
    );
    document.querySelectorAll('.view-options .btn').forEach(b => b.classList.remove('active'));
    $('viewEmployeeSummaryBtn').classList.add('active');
    renderEmployeeSummary(selectedEmployeeCodeEntries);
  } else {
    selectedEmployeeCodeEntries = [];
    reportDisplay.innerHTML = '<p>Select an employee or choose a report option.</p>';
    document.querySelectorAll('.view-options .btn').forEach(b => b.classList.remove('active'));
  }
});

/* ─── CUSTOMER VIEW LISTENERS ────────────────────────────────────────────── */
customerViewMonthSelect.addEventListener('change', () => {
  const branch = customerViewBranchSelect.value;
  if (branch) updateCustomerViewEmployeeDropdown();
  // Don't auto-load — require explicit click or employee selection
});

customerViewBranchSelect.addEventListener('change', () => {
  updateCustomerViewEmployeeDropdown();
  const branch = customerViewBranchSelect.value;
  const emp    = customerViewEmployeeSelect.value;
  if (branch && emp) {
    loadDetailedCustomerReport();
  } else {
    detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select an employee to load customer data.</td></tr>';
    customerDetailsContent.style.display = 'none';
  }
});

customerViewEmployeeSelect.addEventListener('change', () => {
  if (customerViewBranchSelect.value && customerViewEmployeeSelect.value) {
    loadDetailedCustomerReport();
  }
});

$('loadCustomerDataBtn').addEventListener('click', loadDetailedCustomerReport);

downloadDetailedCustomerBtn && downloadDetailedCustomerBtn.addEventListener('click', downloadDetailedCustomerReportCSV);

function updateCustomerViewEmployeeDropdown() {
  const branch    = customerViewBranchSelect.value;
  const monthData = filterDataByMonth(allCanvassingData, customerViewMonthSelect.value);
  if (!branch) {
    customerViewEmployeeSelect.innerHTML = '<option value="">-- Select --</option>';
    return;
  }
  const codes = [...new Set(monthData.filter(e => e[H_BRANCH] === branch).map(e => e[H_EMP_CODE]))]
    .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));
  populateDropdown(customerViewEmployeeSelect, codes, true);
  customerViewEmployeeSelect.value = '';
}

/* ─── VIEW OPTION BUTTONS ────────────────────────────────────────────────── */
function setActiveViewBtn(id) {
  document.querySelectorAll('.view-options .btn').forEach(b => b.classList.remove('active'));
  $(id) && $(id).classList.add('active');
}

$('viewBranchPerformanceReportBtn').addEventListener('click', () => {
  setActiveViewBtn('viewBranchPerformanceReportBtn');
  branchSelect.value
    ? renderBranchPerformanceReport(branchSelect.value)
    : showToast('Select a branch first.', 'error');
});

$('viewEmployeeSummaryBtn').addEventListener('click', () => {
  setActiveViewBtn('viewEmployeeSummaryBtn');
  if (!employeeSelect.value) { showToast('Select an employee first.', 'error'); return; }
  const data = filterDataByMonth(allCanvassingData, monthSelect.value)
    .filter(e => e[H_EMP_CODE] === employeeSelect.value && e[H_BRANCH] === branchSelect.value);
  renderEmployeeSummary(data);
});

$('viewAllEntriesBtn').addEventListener('click', () => {
  setActiveViewBtn('viewAllEntriesBtn');
  let data = filterDataByMonth(allCanvassingData, monthSelect.value);
  if (branchSelect.value)   data = data.filter(e => e[H_BRANCH]   === branchSelect.value);
  if (employeeSelect.value) data = data.filter(e => e[H_EMP_CODE] === employeeSelect.value);
  renderAllEntries(data);
});

$('viewPerformanceReportBtn').addEventListener('click', () => {
  setActiveViewBtn('viewPerformanceReportBtn');
  if (branchSelect.value && employeeSelect.value) {
    const data = filterDataByMonth(allCanvassingData, monthSelect.value)
      .filter(e => e[H_EMP_CODE] === employeeSelect.value && e[H_BRANCH] === branchSelect.value);
    renderEmployeeSummary(data);
  } else renderOverallStaffPerformanceReport();
});

$('viewBranchVisitLeaderboardBtn').addEventListener('click', () => { setActiveViewBtn('viewBranchVisitLeaderboardBtn'); renderLeaderboard('Visit'); });
$('viewBranchCallLeaderboardBtn').addEventListener('click', () => { setActiveViewBtn('viewBranchCallLeaderboardBtn'); renderLeaderboard('Call'); });
$('viewStaffParticipationBtn').addEventListener('click', () => { setActiveViewBtn('viewStaffParticipationBtn'); renderStaffParticipation(); });

downloadOverallBtn && downloadOverallBtn.addEventListener('click', downloadOverallStaffPerformanceReportCSV);

/* ─── RENDERERS ──────────────────────────────────────────────────────────── */

function renderAllBranchSnapshot() {
  const data = filterDataByMonth(allCanvassingData, monthSelect.value);
  let html = '<h2>All Branch Snapshot</h2><div class="table-container"><table class="all-branch-snapshot-table"><thead><tr>';
  ['Branch Name','Active Staff','Total Visits','Total Calls','Total References','Total New Leads'].forEach(h => html += `<th>${h}</th>`);
  html += '</tr></thead><tbody>';
  PREDEFINED_BRANCHES.forEach(branch => {
    const entries = data.filter(e => e[H_BRANCH] === branch);
    const { totalActivity } = calculateTotalActivity(entries);
    const staff = new Set(entries.map(e => e[H_EMP_CODE])).size;
    const zero  = entries.length === 0;
    html += `<tr class="${zero ? 'row-zero' : ''}">
      <td data-label="Branch Name">${branch}</td>
      <td data-label="Active Staff">${staff}</td>
      <td data-label="Total Visits">${totalActivity['Visit']}</td>
      <td data-label="Total Calls">${totalActivity['Call']}</td>
      <td data-label="Total References">${totalActivity['Reference']}</td>
      <td data-label="Total New Leads">${totalActivity['New Customer Leads']}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  reportDisplay.innerHTML = html;
}

function renderNonParticipatingBranches() {
  const data = filterDataByMonth(allCanvassingData, monthSelect.value);
  const zeroBranches = PREDEFINED_BRANCHES.filter(b => {
    const { totalActivity } = calculateTotalActivity(data.filter(e => e[H_BRANCH] === b));
    return totalActivity['Visit'] === 0;
  });
  let html = '<h2>Zero Visit Branches</h2>';
  if (zeroBranches.length) {
    html += `<p>${zeroBranches.length} branch(es) recorded zero visits:</p><ul class="non-participating-branch-list">`;
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
  const employees = [...new Set(data.map(e => e[H_EMP_CODE]))]
    .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

  if (!employees.length) {
    reportDisplay.innerHTML = '<h2>Overall Staff Performance</h2><p>No employee activity found for the selected month.</p>';
    return;
  }

  let html = '<h2>Overall Staff Performance</h2><div class="table-container"><table class="performance-table"><thead>';
  html += '<tr><th>Employee Name</th><th>Branch Name</th><th>Designation</th>';
  metrics.forEach(m => html += `<th colspan="3">${m}</th>`);
  html += '</tr><tr><th></th><th></th><th></th>';
  metrics.forEach(() => html += '<th>Act</th><th>Tgt</th><th>%</th>');
  html += '</tr></thead><tbody>';

  employees.forEach(code => {
    const name    = employeeCodeToNameMap[code]        || code;
    const desig   = employeeCodeToDesignationMap[code] || 'Default';
    const branch  = (data.find(e => e[H_EMP_CODE] === code)||{})[H_BRANCH] || 'N/A';
    const entries = data.filter(e => e[H_EMP_CODE] === code);
    const { totalActivity } = calculateTotalActivity(entries);
    const targets = TARGETS[desig] || TARGETS['Default'];
    const perf    = calculatePerformance(totalActivity, targets);

    html += `<tr><td>${name}</td><td>${branch}</td><td>${desig}</td>`;
    metrics.forEach(m => {
      const act = totalActivity[m] || 0;
      const tgt = targets[m]       || 0;
      const pct = perf[m];
      let pctStr = (isNaN(pct)||tgt===0) ? 'N/A' : `${Math.round(pct)}%`;
      if (act===0 && tgt>0) pctStr = '0%';
      const barClass = (isNaN(pct)||tgt===0) ? 'no-activity' : getProgressBarClass(pct);
      const barW = Math.min(100, isNaN(pct) ? 0 : Math.round(pct));
      html += `<td data-label="Actual">${act}</td><td data-label="Target">${tgt}</td>
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
  const data    = filterDataByMonth(allCanvassingData, monthSelect.value).filter(e => e[H_BRANCH] === branchName);
  if (!data.length) {
    reportDisplay.innerHTML = `<h2>Branch Performance: ${branchName}</h2><p>No activity found for this branch in the selected month.</p>`;
    return;
  }

  const employees = [...new Set(data.map(e => e[H_EMP_CODE]))]
    .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

  // Sticky branch totals
  const branchTotals = calculateTotalActivity(data).totalActivity;
  const metrics = ['Visit','Call','Reference','New Customer Leads'];

  let html = `<h2>Branch Performance: ${branchName}</h2>`;
  html += '<div class="branch-totals-bar">';
  metrics.forEach(m => html += `<span><strong>${m}:</strong> ${branchTotals[m]}</span>`);
  html += '</div>';

  // Per-employee cards (matching original card-based layout)
  html += '<div class="branch-performance-grid">';
  employees.forEach(code => {
    const name    = employeeCodeToNameMap[code]        || code;
    const desig   = employeeCodeToDesignationMap[code] || 'Default';
    const entries = data.filter(e => e[H_EMP_CODE] === code);
    const { totalActivity } = calculateTotalActivity(entries);
    const targets = TARGETS[desig] || TARGETS['Default'];
    const perf    = calculatePerformance(totalActivity, targets);

    html += `<div class="employee-performance-card">
      <h4>${name} <span class="tag">${desig}</span></h4>
      <div style="overflow-x:auto"><table class="performance-table">
        <thead><tr><th>Metric</th><th>Actual</th><th>Target</th><th>%</th></tr></thead>
        <tbody>`;
    metrics.forEach(m => {
      const act = totalActivity[m] || 0;
      const tgt = targets[m]       || 0;
      const pct = perf[m];
      let pctStr     = (isNaN(pct)||tgt===0) ? 'N/A' : `${Math.round(pct)}%`;
      let barClass   = (isNaN(pct)||tgt===0) ? 'no-activity' : getProgressBarClass(pct);
      if (act===0 && tgt>0) { pctStr = '0%'; barClass = 'danger'; }
      html += `<tr>
        <td data-label="Metric">${m}</td>
        <td data-label="Actual">${act}</td>
        <td data-label="Target">${tgt}</td>
        <td data-label="%">${pctStr}</td>
      </tr>`;
    });
    html += '</tbody></table></div></div>';
  });
  html += '</div>';
  reportDisplay.innerHTML = html;
}

function renderEmployeeSummary(employeeActivities) {
  if (!employeeActivities || !employeeActivities.length) {
    reportDisplay.innerHTML = '<h2>Employee Performance Summary</h2><p>No activities found for the selected employee in the selected month.</p>';
    return;
  }
  const code    = employeeActivities[0][H_EMP_CODE];
  const name    = employeeCodeToNameMap[code]        || code;
  const branch  = employeeActivities[0][H_BRANCH];
  const desig   = employeeCodeToDesignationMap[code] || 'Default';
  const { totalActivity, productInterests } = calculateTotalActivity(employeeActivities);
  const targets = TARGETS[desig] || TARGETS['Default'];
  const perf    = calculatePerformance(totalActivity, targets);
  const metrics = ['Visit','Call','Reference','New Customer Leads'];

  // Run-rate projection
  const now = new Date();
  const daysElapsed = now.getDate();
  const projections = {};
  metrics.forEach(m => {
    const daily = daysElapsed > 0 ? totalActivity[m] / daysElapsed : 0;
    projections[m] = Math.round(daily * MONTHLY_WORKING_DAYS);
  });

  let html = `
    <h2>Employee Performance Summary</h2>
    <div class="employee-summary-header">
      <h3>${name} (${code})</h3>
      <p>Branch: ${branch} &nbsp;|&nbsp; Designation: ${desig}</p>
    </div>
    <div class="summary-details">
      <div class="summary-card">
        <h4>Activity Summary</h4>
        <table class="summary-table">
          <thead><tr><th>Metric</th><th>Actual</th><th>Target</th><th>% Achieved</th><th>Projected EOM</th></tr></thead>
          <tbody>`;

  metrics.forEach(m => {
    const act  = totalActivity[m] || 0;
    const tgt  = targets[m]       || 0;
    const pct  = perf[m];
    const proj = projections[m];
    let pctStr = (isNaN(pct)||tgt===0) ? 'N/A' : `${Math.round(pct)}%`;
    if (act===0 && tgt>0) pctStr = '0%';
    const projClass = proj >= tgt ? 'proj-good' : 'proj-risk';
    html += `<tr>
      <td>${m}</td><td>${act}</td><td>${tgt}</td><td>${pctStr}</td>
      <td class="${projClass}">${proj >= tgt ? '✓' : '⚠'} ${proj}</td>
    </tr>`;
  });

  html += `</tbody></table></div>
      <div class="summary-card">
        <h4>Product Interests</h4>
        <p>${productInterests.length > 0 ? productInterests.join(', ') : 'No product interests recorded.'}</p>
      </div>
    </div>
    <button class="btn download-btn" id="downloadEmployeeSummaryCSV" data-employee-code="${code}">⬇ Download Employee Summary CSV</button>`;

  reportDisplay.innerHTML = html;
  $('downloadEmployeeSummaryCSV').addEventListener('click', e => downloadEmployeeSummaryCSV(e.target.dataset.employeeCode));
}

function renderAllEntries(entries, title = 'All Canvassing Entries') {
  if (!entries.length) {
    reportDisplay.innerHTML = `<h2>${title}</h2><p>No entries found for the selected filters.</p>`;
    return;
  }
  const headers = Object.keys(entries[0]);
  let html = `<h2>${title}</h2><div class="table-container"><table class="data-table"><thead><tr>`;
  headers.forEach(h => html += `<th>${h}</th>`);
  html += '</tr></thead><tbody>';
  entries.forEach(entry => {
    html += '<tr>';
    headers.forEach(h => {
      let val = entry[h] || '';
      if (currentAccessLevel === 'limited_data_view') {
        if (h === H_PHONE)   val = maskPhone(val);
        if (h === H_ADDRESS) val = maskAddr(val);
      }
      html += `<td data-label="${h}">${val}</td>`;
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
    const type = (e[H_ACTIVITY_TYPE]||'').trim().toLowerCase();
    const norm = type === 'visit' ? 'Visit' : type === 'calls' ? 'Call' : null;
    if (norm === metricType) totals[e[H_BRANCH]] = (totals[e[H_BRANCH]]||0) + 1;
  });
  const sorted = Object.entries(totals).sort(([,a],[,b]) => b-a);
  let html = `<h2>Branch ${metricType} Leaderboard</h2>`;
  if (!sorted.length) { html += `<p>No ${metricType} activity recorded for the selected month.</p>`; reportDisplay.innerHTML = html; return; }
  html += '<table class="leaderboard-table"><thead><tr><th>Rank</th><th>Branch</th><th>Total</th></tr></thead><tbody>';
  sorted.forEach(([branch, count], i) => {
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    html += `<tr><td>${medal} ${i+1}</td><td>${branch}</td><td>${count}</td></tr>`;
  });
  html += '</tbody></table>';
  reportDisplay.innerHTML = html;
}

function renderStaffParticipation() {
  const data = filterDataByMonth(allCanvassingData, monthSelect.value);
  const activeCodes = new Set(data.map(e => e[H_EMP_CODE]));
  const rows = allUniqueEmployees.map(code => ({
    name:   employeeCodeToNameMap[code]        || code,
    branch: (allCanvassingData.find(e => e[H_EMP_CODE] === code)||{})[H_BRANCH] || 'N/A',
    desig:  employeeCodeToDesignationMap[code] || 'Default',
    active: activeCodes.has(code)
  })).sort((a,b) => a.name.localeCompare(b.name));

  let html = '<h2>Staff Participation</h2><table class="data-table"><thead><tr><th>Employee Name</th><th>Branch</th><th>Designation</th><th>Participated</th></tr></thead><tbody>';
  rows.forEach(r => html += `<tr>
    <td>${r.name}</td><td>${r.branch}</td><td>${r.desig}</td>
    <td class="${r.active?'status-yes':'status-no'}">${r.active?'✓ Yes':'✗ No'}</td>
  </tr>`);
  html += '</tbody></table>';
  reportDisplay.innerHTML = html;
}

/* ─── CUSTOMER VIEW ──────────────────────────────────────────────────────── */

function loadDetailedCustomerReport() {
  const branch = customerViewBranchSelect.value;
  const code   = customerViewEmployeeSelect.value;
  const month  = customerViewMonthSelect.value;

  if (!branch || !code || !month) {
    detailedCustomerReportTableBody.innerHTML =
      '<tr><td colspan="5">Please select Branch, Employee and Month to load customer data.</td></tr>';
    customerDetailsContent.style.display = 'none';
    return;
  }

  const entries = filterDataByMonth(allCanvassingData, month)
    .filter(e => e[H_BRANCH] === branch && e[H_EMP_CODE] === code && (e[H_PROSPECT_NAME]||'').trim() !== '');

  detailedCustomerReportTableBody.innerHTML = '';
  customerDetailsContent.style.display = 'none';

  if (!entries.length) {
    detailedCustomerReportTableBody.innerHTML =
      '<tr><td colspan="5">No detailed customer entries found for the selected employee and month.</td></tr>';
    return;
  }

  entries.forEach(entry => {
    const row  = detailedCustomerReportTableBody.insertRow();
    row.classList.add('customer-list-item');

    const phone = (currentAccessLevel === 'limited_data_view')
      ? maskPhone(entry[H_PHONE]) : (entry[H_PHONE] || 'N/A');

    row.insertCell().textContent = entry[H_PROSPECT_NAME] || 'N/A';
    row.insertCell().textContent = phone;
    row.insertCell().textContent = entry[H_ACTIVITY_TYPE] || 'N/A';
    row.insertCell().textContent = formatDate(entry[H_TIMESTAMP]);

    // "View Details" button
    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View Details';
    viewBtn.className   = 'btn-small';
    viewBtn.addEventListener('click', () => {
      document.querySelectorAll('.customer-list-item.active').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      showCustomerDetails(entry);
    });
    row.insertCell().appendChild(viewBtn);

    // Also allow clicking the whole row
    row.style.cursor = 'pointer';
    row.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      document.querySelectorAll('.customer-list-item.active').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      showCustomerDetails(entry);
    });
  });

  // Auto-show first customer
  const firstRow = detailedCustomerReportTableBody.querySelector('.customer-list-item');
  if (firstRow) {
    firstRow.classList.add('active');
    showCustomerDetails(entries[0]);
  }

  displayMessage('Customer data loaded successfully!', 'success');
}

function showCustomerDetails(entry) {
  if (!entry) { customerDetailsContent.style.display = 'none'; return; }

  const phone   = (currentAccessLevel === 'limited_data_view')
    ? maskPhone(entry[H_PHONE])    : (entry[H_PHONE]   || 'N/A');
  const address = (currentAccessLevel === 'limited_data_view')
    ? maskAddr(entry[H_ADDRESS])   : (entry[H_ADDRESS] || 'N/A');

  $('currentCustomerName').textContent = entry[H_PROSPECT_NAME] || 'N/A';
  $('employeeNameValue').textContent   = entry[H_EMP_NAME]      || 'N/A';
  $('branchNameValue').textContent     = entry[H_BRANCH]        || 'N/A';

  customerCard1.innerHTML = `
    <h4>Contact &amp; Basic Info</h4>
    ${dr('Prospect Name',        entry[H_PROSPECT_NAME])}
    ${dr('Phone',                phone)}
    ${dr('Address',              address)}
    ${dr('Profession',           entry[H_PROFESSION])}
    ${dr('Average Monthly Income', entry[H_INCOME])}
    ${dr('DOB/WD',               formatDate(entry[H_DOB]))}`;

  customerCard2.innerHTML = `
    <h4>Activity &amp; Interests</h4>
    ${dr('Activity Type',        entry[H_ACTIVITY_TYPE])}
    ${dr('Type of Customer',     entry[H_CUSTOMER_TYPE])}
    ${dr('Lead Source',          entry[H_LEAD_SOURCE])}
    ${dr('How Contacted',        entry[H_HOW_CONTACTED])}
    ${dr('Product Interested',   entry[H_PRODUCT])}
    ${dr('Remarks',              entry[H_REMARKS])}
    ${dr('Next Follow-up',       formatDate(entry[H_FOLLOWUP_DATE]))}`;

  customerCard3.innerHTML = `
    <h4>Family &amp; Profile</h4>
    ${dr('Relation with Staff',  entry[H_RELATION])}
    ${dr('Wife/Husband Name',    entry[H_FAMILY_1])}
    ${dr('Wife/Husband Job',     entry[H_FAMILY_2])}
    ${dr('Children Names',       entry[H_FAMILY_3])}
    ${dr('Children Details',     entry[H_FAMILY_4])}
    ${dr('Status of Lead',       entry[H_PROFILE])}`;

  customerDetailsContent.style.display = 'grid';
}

const dr = (label, val) =>
  `<div class="detail-row"><div class="detail-label">${label}:</div><div class="detail-value">${val||'N/A'}</div></div>`;

/* ─── DOWNLOADS ───────────────────────────────────────────────────────────── */

function downloadOverallStaffPerformanceReportCSV() {
  const data    = filterDataByMonth(allCanvassingData, monthSelect.value);
  const metrics = ['Visit','Call','Reference','New Customer Leads'];
  const employees = [...new Set(data.map(e => e[H_EMP_CODE]))]
    .sort((a,b) => (employeeCodeToNameMap[a]||a).localeCompare(employeeCodeToNameMap[b]||b));

  if (!employees.length) { showToast('No data for selected month.', 'info'); return; }

  const rows = [['Employee Name','Branch','Employee Code',
    ...metrics.flatMap(m => [`${m} Actual`,`${m} Target`,`${m} %`])]];

  employees.forEach(code => {
    const entries = data.filter(e => e[H_EMP_CODE] === code);
    const { totalActivity } = calculateTotalActivity(entries);
    const desig   = employeeCodeToDesignationMap[code] || 'Default';
    const targets = TARGETS[desig] || TARGETS['Default'];
    const perf    = calculatePerformance(totalActivity, targets);
    const branch  = (entries[0]||{})[H_BRANCH] || 'N/A';
    const row     = [employeeCodeToNameMap[code]||code, branch, code];
    metrics.forEach(m => {
      const act = totalActivity[m]||0, tgt = targets[m]||0;
      const pct = perf[m];
      row.push(act, tgt, (isNaN(pct)||tgt===0)?'N/A':`${Math.round(pct)}%`);
    });
    rows.push(row);
  });
  dlCSV(rows, `Overall_Staff_Performance_${monthSelect.value}.csv`);
}

function downloadEmployeeSummaryCSV(code) {
  const data    = filterDataByMonth(allCanvassingData, monthSelect.value)
    .filter(e => e[H_EMP_CODE] === code && e[H_BRANCH] === branchSelect.value);
  if (!data.length) { showToast('No activities found for this employee.', 'info'); return; }

  const name    = employeeCodeToNameMap[code] || code;
  const desig   = employeeCodeToDesignationMap[code] || 'Default';
  const targets = TARGETS[desig] || TARGETS['Default'];
  const { totalActivity, productInterests } = calculateTotalActivity(data);
  const perf    = calculatePerformance(totalActivity, targets);

  const monthText = monthSelect.options[monthSelect.selectedIndex]?.text || monthSelect.value;
  const rows = [
    ['Employee Name', name], ['Employee Code', code],
    ['Branch', branchSelect.value], ['Designation', desig],
    ['Report Month', monthText], [],
    ['Activity Summary'], ['Metric','Actual','Target','% Achieved'],
    ...Object.keys(targets).map(m => {
      const act = totalActivity[m]||0, tgt = targets[m];
      const pct = perf[m];
      let pctStr = (isNaN(pct)||tgt===0)?'N/A':`${Math.round(pct)}%`;
      if (act===0&&tgt>0) pctStr='0%';
      return [m, act, tgt, pctStr];
    }),
    [], ['Product Interests', productInterests.join(', ')||'None'], [],
    [`All Entries for ${name} (${monthText})`],
    ...(() => {
      let hdrs = Object.keys(data[0]);
      if (currentAccessLevel==='limited_data_view')
        hdrs = hdrs.filter(h => h!==H_PHONE && h!==H_ADDRESS);
      return [hdrs, ...data.map(e => hdrs.map(h => {
        let v = e[h]||'';
        if (currentAccessLevel==='limited_data_view') {
          if (h===H_PHONE)   v = maskPhone(v);
          if (h===H_ADDRESS) v = maskAddr(v);
        }
        return v;
      }))];
    })()
  ];
  dlCSV(rows, `${name.replace(/\s+/g,'_')}_Summary_${monthSelect.value}.csv`);
  showToast(`Summary for ${name} downloaded.`, 'success');
}

function downloadDetailedCustomerReportCSV() {
  const branch = customerViewBranchSelect.value;
  const code   = customerViewEmployeeSelect.value;
  const month  = customerViewMonthSelect.value;
  if (!branch || !code || !month) { showToast('Select Branch, Employee and Month first.', 'error'); return; }

  const entries = filterDataByMonth(allCanvassingData, month)
    .filter(e => e[H_BRANCH] === branch && e[H_EMP_CODE] === code);
  if (!entries.length) { showToast('No data to download.', 'info'); return; }

  const headers = [
    H_TIMESTAMP, H_DATE, H_BRANCH, H_EMP_NAME, H_EMP_CODE, H_DESIGNATION,
    H_ACTIVITY_TYPE, H_CUSTOMER_TYPE, H_LEAD_SOURCE, H_HOW_CONTACTED,
    H_PROSPECT_NAME, H_PHONE, H_ADDRESS, H_PROFESSION, H_DOB, H_PRODUCT,
    H_REMARKS, H_FOLLOWUP_DATE, H_RELATION, H_FAMILY_1, H_FAMILY_2,
    H_FAMILY_3, H_FAMILY_4, H_PROFILE
  ];

  const rows = [headers, ...entries.map(e => headers.map(h => {
    let v = e[h] || '';
    if (currentAccessLevel === 'limited_data_view') {
      if (h===H_PHONE)   v = maskPhone(v);
      if (h===H_ADDRESS) v = maskAddr(v);
    }
    return v;
  }))];

  const monthText = customerViewMonthSelect.options[customerViewMonthSelect.selectedIndex]?.text || month;
  dlCSV(rows, `Customer_Report_${branch}_${monthText.replace(/\s+/g,'_')}.csv`);
  showToast('Customer Report downloaded.', 'success');
}

function dlCSV(rows, filename) {
  const csv  = rows.map(r => (r||[]).map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:filename, style:'visibility:hidden' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── EMPLOYEE MANAGEMENT ────────────────────────────────────────────────── */

async function sendToGAS(action, data) {
  displayEmployeeManagementMessage('Processing…', false);
  try {
    const res  = await fetch(WEB_APP_URL, {
      method: 'POST', mode: 'cors',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action, data })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
  const data = {
    [H_EMP_NAME]:    $('newEmployeeName').value.trim(),
    [H_EMP_CODE]:    $('newEmployeeCode').value.trim(),
    [H_BRANCH]:      newBranchNameInput.value,
    [H_DESIGNATION]: $('newDesignation').value.trim()
  };
  if (!data[H_EMP_NAME]||!data[H_EMP_CODE]||!data[H_BRANCH]||!data[H_DESIGNATION]) {
    displayEmployeeManagementMessage('All fields are required.', true); return;
  }
  if (await sendToGAS('add_employee', data)) addEmployeeForm.reset();
});

bulkAddEmployeeForm && bulkAddEmployeeForm.addEventListener('submit', async e => {
  e.preventDefault();
  const branch    = bulkEmployeeBranchNameInput.value;
  const rawText   = $('bulkEmployeeDetails').value.trim();
  if (!branch || !rawText) { displayEmployeeManagementMessage('Branch and details required.', true); return; }

  const employees = rawText.split('\n').map(line => {
    const [name, code, desig] = line.split(',').map(s => s.trim());
    return (name && code && desig)
      ? { [H_EMP_NAME]: name, [H_EMP_CODE]: code, [H_DESIGNATION]: desig, [H_BRANCH]: branch }
      : null;
  }).filter(Boolean);

  if (!employees.length) { displayEmployeeManagementMessage('No valid employee data found.', true); return; }
  if (await sendToGAS('bulk_add_employees', { employees })) bulkAddEmployeeForm.reset();
});

deleteEmployeeForm && deleteEmployeeForm.addEventListener('submit', async e => {
  e.preventDefault();
  const code = deleteEmployeeCodeInput.value.trim();
  if (!code) { displayEmployeeManagementMessage('Employee Code is required.', true); return; }
  if (await sendToGAS('delete_employee', { [H_EMP_CODE]: code })) deleteEmployeeForm.reset();
});

/* ─── DROPDOWN UTILITIES ─────────────────────────────────────────────────── */

function populateDropdown(selectEl, items, useCodeForValue = false) {
  selectEl.innerHTML = '<option value="">-- Select --</option>';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value       = item;
    opt.textContent = useCodeForValue ? (employeeCodeToNameMap[item] || item) : item;
    selectEl.appendChild(opt);
  });
}

function populateMonthDropdowns() {
  [monthSelect, customerViewMonthSelect].forEach(el => populateMonthDropdownSingle(el));
}

function populateMonthDropdownSingle(el) {
  if (!el) return;
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const now = new Date();
  const cy  = now.getFullYear(), cm = now.getMonth();
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

/* ─── UTILITIES ─────────────────────────────────────────────────────────────*/

const formatDate = str => {
  if (!str) return '';
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
};

// Defined once — three copies existed in original
const maskPhone = p => (!p || p.length <= 4) ? '***' : '***' + p.slice(-4);
const maskAddr  = a => a ? a.replace(/./g, '*') : 'N/A';

function displayMessage(msg, type = 'info') {
  if (!statusMessage) return;
  statusMessage.innerHTML = `<div class="message ${type}">${msg}</div>`;
  statusMessage.style.display = 'block';
  setTimeout(() => { statusMessage.innerHTML = ''; statusMessage.style.display = 'none'; }, 5000);
}

function displayEmployeeManagementMessage(msg, isError = false) {
  if (!employeeManagementMessage) return;
  employeeManagementMessage.textContent    = msg;
  employeeManagementMessage.style.color    = isError ? 'red' : 'green';
  employeeManagementMessage.style.display  = 'block';
  setTimeout(() => { employeeManagementMessage.style.display = 'none'; }, 5000);
}

function showToast(msg, type = 'info') {
  let t = $('eet-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'eet-toast';
    document.body.appendChild(t);
  }
  t.textContent  = msg;
  t.className    = `eet-toast ${type}`;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

}); // end DOMContentLoaded
