document.addEventListener('DOMContentLoaded', () => {

  // --- START: TWO-TIERED FRONT-END PASSWORD PROTECTION ---
const ACCESS_PASSWORD_FULL = "1"; // Full access password
const ACCESS_PASSWORD_LIMITED = "123";  // Limited access password
const ACCESS_PASSWORD_LIMITED_DATA = "sml4576"; // New password for full access with hidden data
let currentAccessLevel = null; // To store 'full', 'limited', or 'limited_data_view'
const accessDeniedOverlay = document.getElementById('accessDeniedOverlay');
const dashboardContent = document.getElementById('dashboardContent');
const secretPasswordInputContainer = document.getElementById('secretPasswordInputContainer');
const secretPasswordInput = document.getElementById('secretPasswordInput');
const submitSecretPasswordBtn = document.getElementById('submitSecretPassword');
const passwordErrorMessage = document.getElementById('passwordErrorMessage');
// Get references to buttons/tabs that need conditional access
const downloadOverallStaffPerformanceReportBtn = document.getElementById('downloadOverallStaffPerformanceReportBtn');
const detailedCustomerViewTabBtn = document.getElementById('detailedCustomerViewTabBtn');
const viewAllEntriesButton = document.getElementById('viewAllEntriesBtn'); // <--- ADD THIS LINE (OR UPDATE THE EXISTING PLACEHOLDER)
if (secretPasswordInput) {
    secretPasswordInput.focus();
}
submitSecretPasswordBtn.addEventListener('click', () => {
    checkAndSetAccess();
});
secretPasswordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        checkAndSetAccess();
    }
});

function checkAndSetAccess() {
    const enteredPassword = secretPasswordInput.value;

    if (enteredPassword === ACCESS_PASSWORD_FULL) {
        currentAccessLevel = 'full';
        grantAccess();
    } else if (enteredPassword === ACCESS_PASSWORD_LIMITED) {
        currentAccessLevel = 'limited';
        grantAccess();
    } else if (enteredPassword === ACCESS_PASSWORD_LIMITED_DATA) { // New condition for password "1"
        currentAccessLevel = 'limited_data_view'; // Set new access level
        grantAccess();
    } else {
        passwordErrorMessage.textContent = "Incorrect password. Try again.";
        passwordErrorMessage.style.display = 'block';
        secretPasswordInput.value = '';
        secretPasswordInput.focus();
    }
}

function grantAccess() {
    console.log("grantAccess function called!");
    accessDeniedOverlay.style.display = 'none';
    console.log("Access overlay hidden.");

    console.log("Value of dashboardContent:", dashboardContent);
    if (dashboardContent) {
        dashboardContent.style.display = 'block';
        console.log("Dashboard content display set to block.");
    } else {
        console.error("Error: dashboardContent element not found!");
    }

    // Apply access restrictions based on currentAccessLevel
    applyAccessRestrictions();
    // Now, call your main processing function that starts everything
    processData(); // This fetches your data
    // Set initial tab based on access level
    if (currentAccessLevel === 'limited') {
        showTab('allBranchSnapshotTabBtn');
    } else {
        // Full access users get the default initial tab
        showTab('allBranchSnapshotTabBtn');
    }
}

function applyAccessRestrictions() {
    if (currentAccessLevel === 'limited') {
        // Hide "Download Overall Performance" button
        if (downloadOverallStaffPerformanceReportBtn) {
            downloadOverallStaffPerformanceReportBtn.style.display = 'none';
        }
        // Hide "Detailed Customer View" tab
        if (detailedCustomerViewTabBtn) {
            detailedCustomerViewTabBtn.style.display = 'none';
        }
        // Hide "View all entries" button
        if (viewAllEntriesButton) {
            viewAllEntriesButton.style.display = 'none';
        }
    } else if (currentAccessLevel === 'full' || currentAccessLevel === 'limited_data_view') { // Include new access level here
        // Ensure all are visible for full access and limited_data_view
        if (downloadOverallStaffPerformanceReportBtn) {
            downloadOverallStaffPerformanceReportBtn.style.display = 'inline-block';
        }
        if (detailedCustomerViewTabBtn) {
            detailedCustomerViewTabBtn.style.display = 'inline-block';
        }
        if (viewAllEntriesButton) {
            viewAllEntriesButton.style.display = 'inline-block';
        }
    }
}
// This URL is for your Canvassing Data sheet. Ensure it's correct and published as CSV.
const DATA_URL = "https://docs.google.com/spreadsheets/d/1Za1CrlzzXpQjB3yZHjL2ZpRkjXgkVmLHH_LtXJq9K5o/export?format=csv&gid=696550092"; 
// IMPORTANT: Replace this with YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxe_hZyRXZdY1CbfchvH_pzIa596dxmEDnPVc4YGXWerxRmuJz30CpEbND279mR0lWf/exec"; // <-- PASTE YOUR NEWLY DEPLOYED WEB APP URL HERE
// For front-end reporting, all employee and branch data will come from Canvassing Data and predefined list.
   // const EMPLOYEE_MASTER_DATA_URL = "UNUSED"; // Marked as UNUSED for clarity, won't be fetched for reports

    const MONTHLY_WORKING_DAYS = 25; // Common approximation for a month's working days

    const TARGETS = {
        'Branch Manager': {
            'Visit': 10,
            'Call': 2 * MONTHLY_WORKING_DAYS,
            'Reference': 1 * MONTHLY_WORKING_DAYS,
            'New Customer Leads': 20
        },
        'Investment Staff': { // Added Investment Staff with custom Visit target
            'Visit': 15,
            'Call': 2 * MONTHLY_WORKING_DAYS,
            'Reference': 1 * MONTHLY_WORKING_DAYS,
            'New Customer Leads': 20
        },
        'Seniors': { // Added Investment Staff with custom Visit target
            'Visit': 15,
            'Call': 2 * MONTHLY_WORKING_DAYS,
            'Reference': 1 * MONTHLY_WORKING_DAYS,
            'New Customer Leads': 20
        },
        'Default': { // For all other designations not explicitly defined
            'Visit': 5,
            'Call': 2 * MONTHLY_WORKING_DAYS,
            'Reference': 1 * MONTHLY_WORKING_DAYS,
            'New Customer Leads': 20
        }
    };
    // Predefined list of branches for the dropdown and "no participation" check
    const PREDEFINED_BRANCHES = [
        "Angamaly", "Corporate Office", "Edappally", "Harippad", "Koduvayur", "Kuzhalmannam",
        "Mattanchery", "Mavelikara", "Nedumkandom", "Nenmara", "Paravoor", "Perumbavoor",
        "Thiruwillamala", "Thodupuzha", "Chengannur", "Alathur", "Kottayam", "Kattapana",
        "Muvattupuzha", "Thiruvalla", "Pathanamthitta", "Kunnamkulam", "HO KKM" // Corrected "Pathanamthitta" typo if it existed previously
    ].sort();

    // --- Column Headers Mapping (IMPORTANT: These must EXACTLY match the column names in your "Form Responses 2" Google Sheet) ---
    const HEADER_TIMESTAMP = 'Timestamp';
    const HEADER_DATE = 'Date';
    const HEADER_BRANCH_NAME = 'Branch Name';
    const HEADER_EMPLOYEE_NAME = 'Employee Name';
    const HEADER_EMPLOYEE_CODE = 'Employee Code';
    const HEADER_DESIGNATION = 'Designation';
    const HEADER_ACTIVITY_TYPE = 'Activity Type';
    const HEADER_TYPE_OF_CUSTOMER = 'Type of Customer'; // !!! CORRECTED TYPO HERE !!!
    const HEADER_R_LEAD_SOURCE = 'rLead Source';      // Keeping user's provided interpretation of split header
    const HEADER_HOW_CONTACTED = 'How Contacted'; // This is not in the list provided by user, but is in the original script. Keeping it.
    const HEADER_PROSPECT_NAME = 'Prospect Name';
    const HEADER_PHONE_NUMBER_WHATSAPP = 'Phone Numebr(Whatsapp)'; // Keeping user's provided typo
    const HEADER_ADDRESS = 'Address';
    const HEADER_PROFESSION = 'Profession';
    const HEADER_DOB_WD = 'DOB/WD';
    const HEADER_PRODUCT_INTERESTED = 'Prodcut Interested'; // Keeping user's provided typo
    const HEADER_REMARKS = 'Remarks';
    const HEADER_NEXT_FOLLOW_UP_DATE = 'Next Follow-up Date';
    const HEADER_RELATION_WITH_STAFF = 'Relation With Staff';
    // NEW: Customer Detail Headers as provided by user
    const HEADER_FAMILY_DETAILS_1 = 'Family Deatils -1 Name of wife/Husband';
    const HEADER_FAMILY_DETAILS_2 = 'Family Deatils -2 Job of wife/Husband';
    const HEADER_FAMILY_DETAILS_3 = 'Family Deatils -3 Names of Children';
    const HEADER_FAMILY_DETAILS_4 = 'Family Deatils -4 Deatils of Children';
    const HEADER_PROFILE_OF_CUSTOMER = 'Profile of Customer';
const HEADER_AVERAGE_MONTHLY_INCOME = 'Average Monthly Income'; 


    // Core Display and Status Elements
    const reportDisplay = document.getElementById('reportDisplay');
    const statusMessage = document.getElementById('statusMessage');

    // Main Content Sections to toggle
    const reportsSection = document.getElementById('reportsSection');
    const detailedCustomerViewSection = document.getElementById('detailedCustomerViewSection');
    const employeeManagementSection = document.getElementById('employeeManagementSection');

    // Tab buttons for main navigation
    const allBranchSnapshotTabBtn = document.getElementById('allBranchSnapshotTabBtn');
    const allStaffOverallPerformanceTabBtn = document.getElementById('allStaffOverallPerformanceTabBtn');
    const nonParticipatingBranchesTabBtn = document.getElementById('nonParticipatingBranchesTabBtn');
    const branchPerformanceTabBtn = document.getElementById('branchPerformanceTabBtn');
   // const  = document.getElementById('detailedCustomerViewTabBtn');
    const employeeManagementTabBtn = document.getElementById('employeeManagementTabBtn');

    // Dropdowns & Filter Panels
    const branchSelect = document.getElementById('branchSelect');
    const employeeSelect = document.getElementById('employeeSelect');
    const employeeFilterPanel = document.getElementById('employeeFilterPanel'); // New from your list
    const monthSelect = document.getElementById('monthSelect'); // NEW: Month Select
    const customerViewBranchSelect = document.getElementById('customerViewBranchSelect');
    const customerViewEmployeeSelect = document.getElementById('customerViewEmployeeSelect');
    const customerViewMonthSelect = document.getElementById('customerViewMonthSelect'); // NEW: Month Select for Customer View

    // View Option Buttons (from your provided list)
    const viewOptions = document.getElementById('viewOptions');
    const viewBranchPerformanceReportBtn = document.getElementById('viewBranchPerformanceReportBtn');
    const viewEmployeeSummaryBtn = document.getElementById('viewEmployeeSummaryBtn');
    const viewAllEntriesBtn = document.getElementById('viewAllEntriesBtn');
    const viewPerformanceReportBtn = document.getElementById('viewPerformanceReportBtn');
    const viewBranchVisitLeaderboardBtn = document.getElementById('viewBranchVisitLeaderboardBtn');
    const viewBranchCallLeaderboardBtn = document.getElementById('viewBranchCallLeaderboardBtn');
    const viewStaffParticipationBtn = document.getElementById('viewStaffParticipationBtn');

    // Detailed Customer View Specific Elements
    const customerCanvassedList = document.getElementById('customerCanvassedList');
    const customerDetailsContent = document.getElementById('customerDetailsContent');
    const customerCard1 = document.getElementById('customerCard1');
    const customerCard2 = document.getElementById('customerCard2');
    const customerCard3 = document.getElementById('customerCard3');
    const detailedCustomerReportTableBody = document.getElementById('detailedCustomerReportTableBody');

    // Employee Management Form Elements
    const addEmployeeForm = document.getElementById('addEmployeeForm');
    const newEmployeeNameInput = document.getElementById('newEmployeeName');
    const newEmployeeCodeInput = document.getElementById('newEmployeeCode');
    const newBranchNameInput = document.getElementById('newBranchName');
    const newDesignationInput = document.getElementById('newDesignation');
    const employeeManagementMessage = document.getElementById('employeeManagementMessage');

    const bulkAddEmployeeForm = document.getElementById('bulkAddEmployeeForm');
    const bulkEmployeeBranchNameInput = document.getElementById('bulkEmployeeBranchName');
    const bulkEmployeeDetailsTextarea = document.getElementById('bulkEmployeeDetails');

    const deleteEmployeeForm = document.getElementById('deleteEmployeeForm');
    const deleteEmployeeCodeInput = document.getElementById('deleteEmployeeCode');

    // Download Buttons
    const downloadDetailedCustomerReportBtn = document.getElementById('downloadDetailedCustomerReportBtn');
    // const downloadOverallStaffPerformanceReportBtn = document.getElementById('downloadOverallStaffPerformanceReportBtn'); 
    
    // Global variables to store fetched data
    let allCanvassingData = []; // Raw activity data from Form Responses 2
    let allUniqueBranches = []; // Will be populated from PREDEFINED_BRANCHES
    let allUniqueEmployees = []; // Employee codes from Canvassing Data
    let employeeCodeToNameMap = {}; // {code: name} from Canvassing Data
    let employeeCodeToDesignationMap = {}; // {code: designation} from Canvassing Data
    let selectedBranchEntries = []; // Activity entries filtered by branch (for main reports section)
    let selectedEmployeeCodeEntries = []; // Activity entries filtered by employee code (for main reports section)


    // Utility to format date to ISO-MM-DD
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toISOString().split('T')[0];
    };

    // Helper to clear and display messages in a specific div (now targets statusMessageDiv)
    // Helper to clear and display messages in a specific div
function displayMessage(message, type = 'info') {
    // Corrected: Use 'statusMessage' which is declared at the top of DOMContentLoaded
    if (statusMessage) { // Ensure the element exists
        statusMessage.innerHTML = `<div class="message ${type}">${message}</div>`;
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.innerHTML = ''; // Clear message
            statusMessage.style.display = 'none';
        }, 5000); // Hide after 5 seconds
    } else {
        console.error("Error: 'statusMessage' element not found in the DOM.");
    }
}

    // Specific message display for employee management forms
    function displayEmployeeManagementMessage(message, isError = false) {
        if (employeeManagementMessage) {
            employeeManagementMessage.textContent = message;
            employeeManagementMessage.style.color = isError ? 'red' : 'green';
            employeeManagementMessage.style.display = 'block';
            setTimeout(() => {
                employeeManagementMessage.style.display = 'none';
                employeeManagementMessage.textContent = ''; // Clear content
            }, 5000);
        }
    }

    // Function to fetch activity data from Google Sheet (Form Responses 2)
    async function fetchCanvassingData() {
        displayMessage("Fetching activity data...", 'info');
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP error fetching Canvassing Data! Status: ${response.status}. Details: ${errorText}`);
                throw new Error(`Failed to fetch canvassing data. Status: ${response.status}. Please check DATA_URL.`);
            }
            const csvText = await response.text();
            allCanvassingData = parseCSV(csvText);
            console.log('--- Fetched Canvassing Data: ---');
            console.log(allCanvassingData); // Log canvassing data for debugging
            if (allCanvassingData.length > 0) {
                console.log('Canvassing Data Headers (first entry):', Object.keys(allCanvassingData[0]));
            }
            displayMessage("Activity data loaded successfully!", 'success');
        } catch (error) {
            console.error('Error fetching canvassing data:', error);
            displayMessage(`Failed to load activity data: ${error.message}. Please ensure the sheet is published correctly to CSV and the URL is accurate.`, 'error');
            allCanvassingData = [];
        }
    }

    // CSV parsing function (handles commas within quoted strings)
    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = parseCSVLine(lines[0]); // Headers can also contain commas in quotes
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length !== headers.length) {
                console.warn(`Skipping malformed row ${i + 1}: Expected ${headers.length} columns, got ${values.length}. Line: "${lines[i]}"`);
                continue;
            }
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            data.push(entry);
        }
        return data;
    }

    // Helper to parse a single CSV line safely
    function parseCSVLine(line) {
        const result = [];
        let inQuote = false;
        let currentField = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        result.push(currentField.trim());
        return result;
    }


    // Process fetched data to populate filters and prepare for reports
    async function processData() {
        // Only fetch canvassing data, ignoring MasterEmployees for front-end reports
        await fetchCanvassingData(); 

        // Re-initialize allUniqueBranches from the predefined list
        allUniqueBranches = [...PREDEFINED_BRANCHES].sort(); // Use the hardcoded list

        // Populate employeeCodeToNameMap and employeeCodeToDesignationMap ONLY from Canvassing Data
        employeeCodeToNameMap = {}; // Reset map before populating
        employeeCodeToDesignationMap = {}; // Reset map before populating
        allCanvassingData.forEach(entry => {
            const employeeCode = entry[HEADER_EMPLOYEE_CODE];
            const employeeName = entry[HEADER_EMPLOYEE_NAME];
            const designation = entry[HEADER_DESIGNATION];

            if (employeeCode) {
                // If an employee code exists in canvassing data, use its name/designation
                employeeCodeToNameMap[employeeCode] = employeeName || employeeCode;
                employeeCodeToDesignationMap[employeeCode] = designation || 'Default';
            }
        });

        // Re-populate allUniqueEmployees based ONLY on canvassing data
        allUniqueEmployees = [...new Set(allCanvassingData.map(entry => entry[HEADER_EMPLOYEE_CODE]))].sort((codeA, codeB) => {
            // Use the name from the map if available, otherwise use the code for sorting and display
            const nameA = employeeCodeToNameMap[codeA] || codeA;
            const nameB = employeeCodeToNameMap[codeB] || codeB;
            return nameA.localeCompare(nameB);
        });
	window.allCanvassingData = allCanvassingData;
        populateDropdown(branchSelect, allUniqueBranches); // Populate branch dropdown with predefined branches
        populateDropdown(customerViewBranchSelect, allUniqueBranches); // Populate branch dropdown for detailed customer view
        
        // NEW: Populate month dropdowns
        populateMonthDropdowns();
        updateCustomerViewEmployeeDropdown(); // NEW: Call for initial setup of customer view employee dropdown

        console.log('Final All Unique Branches (Predefined):', allUniqueBranches);
        console.log('Final Employee Code To Name Map (from Canvassing Data):', employeeCodeToNameMap);
        console.log('Final Employee Code To Designation Map (from Canvassing Data):', employeeCodeToDesignationMap);
        console.log('Final All Unique Employees (Codes from Canvassing Data):', allUniqueEmployees);

        // After data is loaded and maps are populated, render the initial report
        renderAllBranchSnapshot(); // Render the default "All Branch Snapshot" report
    }

    // Populate dropdown utility
    function populateDropdown(selectElement, items, useCodeForValue = false) {
        selectElement.innerHTML = '<option value="">-- Select --</option>'; // Default option
        items.forEach(item => {
            const option = document.createElement('option');
            if (useCodeForValue) {
                // Display name from map or code itself
                option.value = item; // item is employeeCode
                option.textContent = employeeCodeToNameMap[item] || item;
            } else {
                option.value = item; // item is branch name
                option.textContent = item;
            }
            selectElement.appendChild(option);
        });
    }

    // NEW: Function to populate month dropdowns
   function populateMonthDropdowns() {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1; // Calculate 2025

    [monthSelect, customerViewMonthSelect].forEach(selectElement => {
        selectElement.innerHTML = ''; 
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Select Month --';
        selectElement.appendChild(defaultOption);

        // Loop through both years (Previous and Current)
        [previousYear, currentYear].forEach(year => {
            months.forEach((month, index) => {
                const option = document.createElement('option');
                option.value = `${index + 1}-${year}`; 
                option.textContent = `${month} ${year}`;
                selectElement.appendChild(option);
            });
        });

        // Keep the current month/year selected by default
        selectElement.value = `${currentMonthIndex + 1}-${currentYear}`;
    });
}

    // NEW: Function to filter data by selected month and year
    // This function filters your data by selected month and year
// It also now includes a warning to help you find problematic timestamps.
function filterDataByMonth(data, selectedMonthValue) {
    if (!selectedMonthValue) {
        return data; // If no month is selected, return all data
    }
    const [monthIndexStr, yearStr] = selectedMonthValue.split('-');
    const selectedMonth = parseInt(monthIndexStr) - 1; // Convert to 0-indexed month
    const selectedYear = parseInt(yearStr);

    return data.filter(entry => {
        const timestampValue = entry[HEADER_TIMESTAMP];
        const entryDate = new Date(timestampValue);

        // --- NEW CODE ADDED HERE FOR DEBUGGING TIMESTAMP ISSUES ---
        // If JavaScript cannot understand the timestamp, it creates an "Invalid Date".
        // This checks for that and prints a warning to your browser's console.
        if (isNaN(entryDate.getTime())) {
            console.warn(`Warning: Timestamp parsing failed for entry with value: '${timestampValue}'. This entry will be excluded from month filtering.`);
            return false; // Exclude entries that have an invalid date
        }
        // --- END OF NEW CODE ---

        // Only include entries where the month and year match the selected ones
        return entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear;
    });
}

    // Filter employees based on selected branch
    branchSelect.addEventListener('change', () => {
        const selectedBranch = branchSelect.value;
        const selectedMonthValue = monthSelect.value; // Get selected month value

        // Filter allCanvassingData by selected month first
        let filteredByMonthData = filterDataByMonth(allCanvassingData, selectedMonthValue);

        if (selectedBranch) {
            employeeFilterPanel.style.display = 'block';

            // Get employee codes ONLY from filteredByMonthData for the selected branch
            const employeeCodesInBranchFromCanvassing = filteredByMonthData
                .filter(entry => entry[HEADER_BRANCH_NAME] === selectedBranch)
                .map(entry => entry[HEADER_EMPLOYEE_CODE]);

            // Combine and unique all employee codes for the selected branch
            const combinedEmployeeCodes = new Set([
                ...employeeCodesInBranchFromCanvassing
            ]);

            // Convert Set back to array and sort
            const sortedEmployeeCodesInBranch = [...combinedEmployeeCodes].sort((codeA, codeB) => {
                // Use the name from the map if available, otherwise use the code for sorting and display
                const nameA = employeeCodeToNameMap[codeA] || codeA;
                const nameB = employeeCodeToNameMap[codeB] || codeB;
                return nameA.localeCompare(nameB);
            });

            populateDropdown(employeeSelect, sortedEmployeeCodesInBranch, true);
            viewOptions.style.display = 'flex'; // Show view options
            // Reset employee selection and employee-specific display when branch changes
            employeeSelect.value = "";
            selectedEmployeeCodeEntries = []; // Clear previous activity filter
            reportDisplay.innerHTML = '<p>Select an employee or choose a report option.</p>';

            // Deactivate all buttons in viewOptions and then reactivate the appropriate ones
            document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));

        } else {
            employeeFilterPanel.style.display = 'none';
            viewOptions.style.display = 'none'; // Hide view options
            reportDisplay.innerHTML = '<p>Please select a branch from the dropdown above to view reports.</p>';
            selectedBranchEntries = []; // Clear previous activity filter
            selectedEmployeeCodeEntries = []; // Clear previous activity filter
        }
    });

    // Handle employee selection (now based on employee CODE)
    employeeSelect.addEventListener('change', () => {
        const selectedEmployeeCode = employeeSelect.value;
        const selectedMonthValue = monthSelect.value; // Get selected month value

        // Filter allCanvassingData by selected month first
        let filteredByMonthData = filterDataByMonth(allCanvassingData, selectedMonthValue);

        if (selectedEmployeeCode) {
            // Filter activity data by employee code (from filteredByMonthData)
            selectedEmployeeCodeEntries = filteredByMonthData.filter(entry =>
                entry[HEADER_EMPLOYEE_CODE] === selectedEmployeeCode &&
                entry[HEADER_BRANCH_NAME] === branchSelect.value // Filter by selected branch as well
            );
            const employeeDisplayName = employeeCodeToNameMap[selectedEmployeeCode] || selectedEmployeeCode;
            reportDisplay.innerHTML = `<p>Ready to view reports for ${employeeDisplayName}.</p>`;
            
            // Automatically trigger the Employee Summary (d4.PNG style)
            document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
            viewEmployeeSummaryBtn.classList.add('active'); // Set Employee Summary as active
            renderEmployeeSummary(selectedEmployeeCodeEntries); // Render the Employee Summary
            
        } else {
            selectedEmployeeCodeEntries = []; // Clear previous activity filter
            reportDisplay.innerHTML = '<p>Select an employee or choose a report option.S</p>';
            // Clear active button if employee selection is cleared
            document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        }
    });

    // NEW: Event listener for monthSelect dropdown (main reports section)
    monthSelect.addEventListener('change', () => {
        // Re-render the active report or default report based on month change
        const currentActiveTab = document.querySelector('.tab-button.active');
        if (currentActiveTab) {
            if (currentActiveTab.id === 'allBranchSnapshotTabBtn') {
                renderAllBranchSnapshot();
            } else if (currentActiveTab.id === 'allStaffOverallPerformanceTabBtn') {
                renderOverallStaffPerformanceReport();
            } else if (currentActiveTab.id === 'nonParticipatingBranchesTabBtn') {
                renderNonParticipatingBranches();
            } else if (currentActiveTab.id === 'branchPerformanceTabBtn') {
                const selectedBranch = branchSelect.value;
                if (selectedBranch) {
                    renderBranchPerformanceReport(selectedBranch);
                } else {
                    reportDisplay.innerHTML = '<p>Please select a branch and a month to view the Branch Performance Report.</p>';
                }
            } else if (currentActiveTab.id === 'performanceSummaryTabBtn') {
                const selectedBranch = branchSelect.value;
                const selectedEmployee = employeeSelect.value;
                if (selectedBranch && selectedEmployee) {
                    const filteredEntries = filterDataByMonth(allCanvassingData, monthSelect.value).filter(entry =>
                        entry[HEADER_EMPLOYEE_CODE] === selectedEmployee &&
                        entry[HEADER_BRANCH_NAME] === selectedBranch
                    );
                    renderEmployeeSummary(filteredEntries);
                } else {
                    reportDisplay.innerHTML = '<p>Please select a branch, an employee, and a month to view the Performance Summary.</p>';
                }
            }
        } else {
            // Default to All Branch Snapshot if no tab is active (shouldn't happen with initial load)
            renderAllBranchSnapshot();
        }
    });


    // NEW: Event listener for customerViewMonthSelect dropdown
   // This makes the "Employee" dropdown update when you change the MONTH
customerViewMonthSelect.addEventListener('change', () => {
    // If a branch is already chosen, update the employee list
    const selectedBranch = customerViewBranchSelect.value;
    if (selectedBranch) {
        updateCustomerViewEmployeeDropdown();
    }
    loadDetailedCustomerReport(); // Reload the customer report
});
    // This is a NEW section: It makes the "Employee" dropdown update when you change the BRANCH
customerViewBranchSelect.addEventListener('change', () => {
    updateCustomerViewEmployeeDropdown(); // Update employee list when branch changes
    // If both branch and employee are selected, load the report
    const selectedBranch = customerViewBranchSelect.value;
    const selectedEmployee = customerViewEmployeeSelect.value;
    if (selectedBranch && selectedEmployee) {
        loadDetailedCustomerReport();
    } else {
        // Show a message if no employee is selected yet
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select an employee to load customer data.</td></tr>';
        customerDetailsContent.style.display = 'none';
    }
});

    // Helper to calculate total activity from a set of activity entries based on Activity Type
    function calculateTotalActivity(entries) {
        const totalActivity = { 'Visit': 0, 'Call': 0, 'Reference': 0, 'New Customer Leads': 0 }; // Initialize counters
        const productInterests = new Set(); // To collect unique product interests
        
        console.log('Calculating total activity for entries:', entries.length); // Log entries being processed
        entries.forEach((entry, index) => {
            let activityType = entry[HEADER_ACTIVITY_TYPE];
            let typeOfCustomer = entry[HEADER_TYPE_OF_CUSTOMER];
            let productInterested = entry[HEADER_PRODUCT_INTERESTED]; // Get product interested

            // Trim and convert to lowercase for robust comparison
            const trimmedActivityType = activityType ? activityType.trim().toLowerCase() : '';
            const trimmedTypeOfCustomer = typeOfCustomer ? typeOfCustomer.trim().toLowerCase() : '';
            const trimmedProductInterested = productInterested ? productInterested.trim() : ''; // Don't lowercase products unless explicitly asked

            console.log(`--- Entry ${index + 1} Debug ---`);
            console.log(`  Processed Activity Type (trimmed, lowercase): '${trimmedActivityType}'`);
            console.log(`  Processed Type of Customer (trimmed, lowercase): '${trimmedTypeOfCustomer}'`);
            console.log(`  Processed Product Interested (trimmed): '${trimmedProductInterested}'`);


            // Direct matching to user's provided sheet values (now lowercase)
            if (trimmedActivityType === 'visit') {
                totalActivity['Visit']++;
            } else if (trimmedActivityType === 'calls') { // Matches "Calls" from sheet, now lowercase
                totalActivity['Call']++;
            } else if (trimmedActivityType === 'referance') { // Matches "Referance" (with typo) from sheet, now lowercase
                totalActivity['Reference']++;
            } else {
                // If it's not one of the direct activity types, log for debugging
                console.warn(`  Unknown or unhandled Activity Type encountered (trimmed, lowercase): '${trimmedActivityType}'.`);
            }
            
            // --- UPDATED LOGIC FOR 'New Customer Leads' ---
            // Based on the user's previously working script, New Customer Leads are counted
            // if the 'Type of Customer' (now correctly spelled) is simply 'new', regardless of 'Activity Type'.
            if (trimmedTypeOfCustomer === 'new') {
                totalActivity['New Customer Leads']++;
                console.log(`  New Customer Lead INCREMENTED based on Type of Customer === 'new'.`);
            } else {
                console.log(`  New Customer Lead NOT INCREMENTED: Type of Customer is not 'new'.`);
            }
            // --- END UPDATED LOGIC ---

            // Collect unique product interests
            if (trimmedProductInterested) {
                productInterests.add(trimmedProductInterested);
            }
            console.log(`--- End Entry ${index + 1} Debug ---`);
        });
        console.log('Calculated Total Activity Final:', totalActivity);
        
        // Return both total activities and product interests
        return { totalActivity, productInterests: [...productInterests] };
    }

    // Render All Branch Snapshot (now uses PREDEFINED_BRANCHES and checks for participation)
    function renderAllBranchSnapshot() {
        reportDisplay.innerHTML = '<h2>All Branch Snapshot</h2>';
        
        const table = document.createElement('table');
        table.className = 'all-branch-snapshot-table';
        
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const headers = ['Branch Name', 'Employees with Activity', 'Total Visits', 'Total Calls', 'Total References', 'Total New Customer Leads'];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();

        // Get selected month value
        const selectedMonthValue = monthSelect.value;
        const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);

        PREDEFINED_BRANCHES.forEach(branch => {
            const branchActivityEntries = filteredData.filter(entry => entry[HEADER_BRANCH_NAME] === branch);
            const { totalActivity } = calculateTotalActivity(branchActivityEntries); // Destructure to get totalActivity
            const employeeCodesInBranch = [...new Set(branchActivityEntries.map(entry => entry[HEADER_EMPLOYEE_CODE]))];
            const displayEmployeeCount = employeeCodesInBranch.length;

            const row = tbody.insertRow();
            // Assign data-label for mobile view
            row.insertCell().setAttribute('data-label', 'Branch Name');
            row.lastChild.textContent = branch;

            row.insertCell().setAttribute('data-label', 'Employees with Activity');
            row.lastChild.textContent = displayEmployeeCount;

            row.insertCell().setAttribute('data-label', 'Total Visits');
            row.lastChild.textContent = totalActivity['Visit'];

            row.insertCell().setAttribute('data-label', 'Total Calls');
            row.lastChild.textContent = totalActivity['Call'];

            row.insertCell().setAttribute('data-label', 'Total References');
            row.lastChild.textContent = totalActivity['Reference'];

            row.insertCell().setAttribute('data-label', 'Total New Customer Leads');
            row.lastChild.textContent = totalActivity['New Customer Leads'];
        });

        reportDisplay.appendChild(table);
    }

   
    // NEW: Render Non-Participating Branches Report (now Zero Visit Branches)
    function renderNonParticipatingBranches() {
        reportDisplay.innerHTML = '<h2>Zero Visit Branches</h2>'; // Changed title
        const zeroVisitBranches = [];

        // Get selected month value
        const selectedMonthValue = monthSelect.value;
        const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);

        PREDEFINED_BRANCHES.forEach(branch => {
            const branchActivityEntries = filteredData.filter(entry => entry[HEADER_BRANCH_NAME] === branch);
            const { totalActivity } = calculateTotalActivity(branchActivityEntries); // Get total activities

            // Check if total visits for this branch is 0
            if (totalActivity['Visit'] === 0) {
                zeroVisitBranches.push(branch);
            }
        });

        if (zeroVisitBranches.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'non-participating-branch-list'; // Reusing existing class
            zeroVisitBranches.forEach(branch => {
                const li = document.createElement('li');
                li.textContent = branch;
                ul.appendChild(li);
            });
            reportDisplay.appendChild(ul);
        } else {
            reportDisplay.innerHTML += '<p class="no-participation-message">All predefined branches have recorded visits for the selected month!</p>'; // Changed message
        }
    }

    // Render All Staff Overall Performance Report (for d1.PNG)
    function renderOverallStaffPerformanceReport() {
        reportDisplay.innerHTML = '<h2>Overall Staff Performance Report</h2>';
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-table-container'; // For horizontal scrolling
        
        const table = document.createElement('table');
        table.className = 'performance-table';
        
        const thead = table.createTHead();
        let headerRow = thead.insertRow();
        
        // Main Headers
        headerRow.insertCell().textContent = 'Employee Name';
        headerRow.insertCell().textContent = 'Branch Name';
        headerRow.insertCell().textContent = 'Designation';
        
        // Define metrics for the performance table
        const metrics = ['Visit', 'Call', 'Reference', 'New Customer Leads'];
        
        metrics.forEach(metric => {
            const th = document.createElement('th');
            th.colSpan = 3; // 'Actual', 'Target', '%'
            th.textContent = metric;
            headerRow.appendChild(th);
        });

        // Sub-headers
        headerRow = thead.insertRow(); // New row for sub-headers
        headerRow.insertCell(); // Empty cell for Employee Name
        headerRow.insertCell(); // Empty cell for Branch Name
        headerRow.insertCell(); // Empty cell for Designation
        metrics.forEach(() => {
            ['Act', 'Tgt', '%'].forEach(subHeader => {
                const th = document.createElement('th');
                th.textContent = subHeader;
                headerRow.appendChild(th);
            });
        });

        const tbody = table.createTBody();
        const selectedMonthValue = monthSelect.value; // Get selected month value
        const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);

        // Get unique employees who have made at least one entry in the selected month
        const employeesWithActivityThisMonth = [...new Set(filteredData
            .map(entry => entry[HEADER_EMPLOYEE_CODE]))].sort((codeA, codeB) => {
                const nameA = employeeCodeToNameMap[codeA] || codeA;
                const nameB = employeeCodeToNameMap[codeB] || codeB;
                return nameA.localeCompare(nameB);
            });


        if (employeesWithActivityThisMonth.length === 0) {
            reportDisplay.innerHTML += '<p>No employee activity found for the selected month.</p>';
            return;
        }

        employeesWithActivityThisMonth.forEach(employeeCode => {
            const employeeName = employeeCodeToNameMap[employeeCode] || employeeCode;
            const branchName = filteredData.find(entry => entry[HEADER_EMPLOYEE_CODE] === employeeCode)?.[HEADER_BRANCH_NAME] || 'N/A';
            const designation = employeeCodeToDesignationMap[employeeCode] || 'Default';

            const employeeActivities = filteredData.filter(entry =>
                entry[HEADER_EMPLOYEE_CODE] === employeeCode
            );
            const { totalActivity } = calculateTotalActivity(employeeActivities);
            
            const targets = TARGETS[designation] || TARGETS['Default'];
            const performance = calculatePerformance(totalActivity, targets);

            const row = tbody.insertRow();
            row.insertCell().textContent = employeeName;
            row.insertCell().textContent = branchName;
            row.insertCell().textContent = designation;

            metrics.forEach(metric => {
                const actualValue = totalActivity[metric] || 0;
                const targetValue = targets[metric] || 0; // Ensure target is 0 if undefined
                let percentValue = performance[metric];
                let displayPercent;
                let progressBarClass;
                let progressWidth;

                if (isNaN(percentValue) || targetValue === 0) { // If target is 0, it's N/A
                    displayPercent = 'N/A';
                    progressWidth = 0;
                    progressBarClass = 'no-activity';
                } else {
                    displayPercent = `${Math.round(percentValue)}%`;
                    progressWidth = Math.min(100, Math.round(percentValue));
                    progressBarClass = getProgressBarClass(percentValue);
                }
                // Special handling for 0 actuals with positive targets to show 0% and danger color
                if (actualValue === 0 && targetValue > 0) {
                    displayPercent = '0%';
                    progressWidth = 0;
                    progressBarClass = 'danger';
                }

                row.insertCell().textContent = actualValue;
                row.insertCell().textContent = targetValue;
                const percentCell = row.insertCell();
                percentCell.innerHTML = `
                    <div class="progress-bar-container-small">
                        <div class="progress-bar ${progressBarClass}" style="width: ${progressWidth === 0 && displayPercent !== 'N/A' ? '30px' : progressWidth}%">
                            ${displayPercent}
                        </div>
                    </div>
                `;
            });
        });
        tableContainer.appendChild(table);
        reportDisplay.appendChild(tableContainer);
    }
    // --- NEW: Function to generate and download the Overall Staff Performance Report as CSV ---
    function downloadOverallStaffPerformanceReportCSV() {
        const selectedMonthValue = monthSelect.value;
        const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);

        // Get all employees who have had activity in the selected month
        const employeesWithActivityThisMonth = [...new Set(filteredData
            .map(entry => entry[HEADER_EMPLOYEE_CODE]))].sort((codeA, codeB) => {
                const nameA = employeeCodeToNameMap[codeA] || codeA;
                const nameB = employeeCodeToNameMap[codeB] || codeB;
                return nameA.localeCompare(nameB);
            });

        if (employeesWithActivityThisMonth.length === 0) {
            displayMessage("No employee activity found for the selected month to download.", 'info');
            return;
        }

        // Define metrics for the performance table
        const metrics = ['Visit', 'Call', 'Reference', 'New Customer Leads'];
        const csvRows = [];

        // Add main headers
        let headers = ['Employee Name', 'Branch Name', 'Employee Code'];
        metrics.forEach(metric => {
            headers.push(`${metric} Actual`, `${metric} Target`, `${metric} %`);
        });
        csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')); // Quote headers

        employeesWithActivityThisMonth.forEach(employeeCode => {
            const employeeName = employeeCodeToNameMap[employeeCode] || employeeCode;
            const branchName = filteredData.find(entry => entry[HEADER_EMPLOYEE_CODE] === employeeCode)?.[HEADER_BRANCH_NAME] || 'N/A';
            const designation = employeeCodeToDesignationMap[employeeCode] || 'Default';

            const employeeActivities = filteredData.filter(entry =>
                entry[HEADER_EMPLOYEE_CODE] === employeeCode
            );
            const { totalActivity } = calculateTotalActivity(employeeActivities); // Use existing calculation
            
            const targets = TARGETS[designation] || TARGETS['Default']; // Use existing targets
            const performance = calculatePerformance(totalActivity, targets); // Use existing performance calculation

            let rowData = [employeeName, branchName, employeeCode];
            metrics.forEach(metric => {
                const actualValue = totalActivity[metric] || 0;
                const targetValue = targets[metric] || 0;
                let percentValue = performance[metric];
                let displayPercent;

                if (isNaN(percentValue) || targetValue === 0) {
                    displayPercent = 'N/A';
                } else {
                    displayPercent = `${Math.round(percentValue)}%`;
                }
                if (actualValue === 0 && targetValue > 0) {
                    displayPercent = '0%';
                }
                rowData.push(actualValue, targetValue, displayPercent);
            });
            csvRows.push(rowData.map(cell => { // Ensure values are properly quoted if they contain commas or quotes
                const stringCell = String(cell);
                return `"${stringCell.replace(/"/g, '""')}"`;
            }).join(','));
        });
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // Feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'Overall_Staff_Performance_Report.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            displayMessage("Overall Staff Performance Report downloaded successfully!", 'success');
        } else { // Fallback for browsers that don't support download attribute
            displayMessage("Your browser does not support automatic downloads. Please copy the data manually.", 'error'); // Optionally display the CSV data for manual copying
            console.log(csvString);
        }
    }
    // --- END NEW --- 
  // Function to load and display the detailed customer report list
function loadDetailedCustomerReport() {
    const selectedBranch = customerViewBranchSelect.value;
    const selectedEmployeeCode = customerViewEmployeeSelect.value;
    const selectedMonthValue = customerViewMonthSelect.value;

    if (!selectedBranch || !selectedEmployeeCode || !selectedMonthValue) {
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Please select a Branch, Employee, and Month to view customer data.</td></tr>';
        // Clear previous customer details if filters are incomplete
        customerDetailsContent.style.display = 'none';
        return;
    }

    // Filter all canvassing data by selected branch, employee, and month
    let filteredCustomerEntries = filterDataByMonth(allCanvassingData, selectedMonthValue);
    filteredCustomerEntries = filteredCustomerEntries.filter(entry =>
        entry[HEADER_BRANCH_NAME] === selectedBranch &&
        entry[HEADER_EMPLOYEE_CODE] === selectedEmployeeCode
    );

    detailedCustomerReportTableBody.innerHTML = ''; // Clear previous entries

    if (filteredCustomerEntries.length === 0) {
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">No customer entries found for the selected criteria.</td></tr>';
        customerDetailsContent.style.display = 'none'; // Hide details section if no data
        return;
    }

    // Populate the customer canvassed list
    filteredCustomerEntries.forEach(entry => {
        const row = detailedCustomerReportTableBody.insertRow();
        row.className = 'customer-list-item'; // Add class for styling/selection
        row.setAttribute('data-customer-id', entry[HEADER_TIMESTAMP]); // Use timestamp as a unique ID

        // Use Employee Name & Branch Name from the entry for the list display if needed
        const employeeNameForList = entry[HEADER_EMPLOYEE_NAME] || 'N/A';
        const branchNameForList = entry[HEADER_BRANCH_NAME] || 'N/A';

        // --- MODIFICATION START ---
        const displayPhoneNumberForList = (currentAccessLevel === 'limited_data_view') ? '***' : (entry[HEADER_PHONE_NUMBER_WHATSAPP] || 'N/A');
        // --- MODIFICATION END ---

        row.insertCell().textContent = entry[HEADER_PROSPECT_NAME] || 'N/A';
        row.insertCell().textContent = displayPhoneNumberForList; // Use masked/unmasked phone number
        row.insertCell().textContent = entry[HEADER_ACTIVITY_TYPE] || 'N/A';
        row.insertCell().textContent = formatDate(entry[HEADER_DATE]); // Format the date

        // Store the full entry data on the row for easy retrieval when clicked
        // You might use a more robust way for larger datasets, like an ID lookup map
        row.customerData = entry; // Attaching the whole data object to the row element

        row.addEventListener('click', () => {
            // Remove active class from previously selected row
            const activeRow = document.querySelector('.customer-list-item.active');
            if (activeRow) {
                activeRow.classList.remove('active');
            }
            // Add active class to clicked row
            row.classList.add('active');
            displaySelectedCustomerDetails(row.customerData); // Call the new function to display details
        });
    });

    // Automatically select the first customer if available
    if (filteredCustomerEntries.length > 0) {
        const firstRow = detailedCustomerReportTableBody.querySelector('.customer-list-item');
        if (firstRow) {
            firstRow.classList.add('active'); // Highlight first row
            displaySelectedCustomerDetails(firstRow.customerData);
        }
    } else {
        customerDetailsContent.style.display = 'none'; // Hide details if no customers
    }
}

// Helper function to mask phone numbers
function maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return 'N/A';
    if (phoneNumber.length <= 4) return '***'; // Mask short numbers fully
    return '***' + phoneNumber.slice(-4);
}

// Helper function to mask addresses
function maskAddress(address) {
    if (!address) return 'N/A';
    // Simple masking: replace most characters with asterisks
    return address.replace(/./g, '*');
}

// Function to display details of a selected customer
function displaySelectedCustomerDetails(customer) {
console.log("displaySelectedCustomerDetails function called!"); // <--- ADD THIS LINE
console.log(customer); // <--- Make sure this line is also there
    if (!customer) {
        customerDetailsContent.style.display = 'none';
        return;
    }

    // --- MODIFICATION START ---
    const displayPhoneNumber = (currentAccessLevel === 'limited_data_view') ? maskPhoneNumber(customer[HEADER_PHONE_NUMBER_WHATSAPP]) : (customer[HEADER_PHONE_NUMBER_WHATSAPP] || 'N/A');
    const displayAddress = (currentAccessLevel === 'limited_data_view') ? maskAddress(customer[HEADER_ADDRESS]) : (customer[HEADER_ADDRESS] || 'N/A');
    // --- MODIFICATION END ---


    // Update the customer name in the main heading of the detailed view
    document.getElementById('currentCustomerName').textContent = customer[HEADER_PROSPECT_NAME] || 'N/A';

    // Populate the new Employee Name and Branch Name fields
    document.getElementById('employeeNameValue').textContent = customer[HEADER_EMPLOYEE_NAME] || 'N/A';
    document.getElementById('branchNameValue').textContent = customer[HEADER_BRANCH_NAME] || 'N/A';

// Populate Contact & Basic Info card
document.getElementById('customerCard1').innerHTML = `
    <h4>Contact & Basic Info</h4>
    <div class="detail-row"><div class="detail-label">Prospect Name:</div><div class="detail-value">${customer[HEADER_PROSPECT_NAME] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Phone:</div><div class="detail-value">${displayPhoneNumber}</div></div>
    <div class="detail-row"><div class="detail-label">Address:</div><div class="detail-value">${displayAddress}</div></div>
    <div class="detail-row"><div class="detail-label">Profession:</div><div class="detail-value">${customer[HEADER_PROFESSION] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Average Monthly Income:</div><div class="detail-value">${customer[HEADER_AVERAGE_MONTHLY_INCOME] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">DOB/WD:</div><div class="detail-value">${formatDate(customer[HEADER_DOB_WD])}</div></div>
`;

// Populate Activity & Interests card (no changes needed for this specific request)
document.getElementById('customerCard2').innerHTML = `
    <h4>Activity & Interests</h4>
    <div class="detail-row"><div class="detail-label">Activity Type:</div><div class="detail-value">${customer[HEADER_ACTIVITY_TYPE] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Type of Customer:</div><div class="detail-value">${customer[HEADER_TYPE_OF_CUSTOMER] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Lead Source:</div><div class="detail-value">${customer[HEADER_R_LEAD_SOURCE] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">How Contacted:</div><div class="detail-value">${customer[HEADER_HOW_CONTACTED] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Product Interested:</div><div class="detail-value">${customer[HEADER_PRODUCT_INTERESTED] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Remarks:</div><div class="detail-value">${customer[HEADER_REMARKS] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Next Follow-up:</div><div class="detail-value">${formatDate(customer[HEADER_NEXT_FOLLOW_UP_DATE])}</div></div>
`;

// Populate Family & Profile card (renamed "Customer Profile" to "Status of Lead")
document.getElementById('customerCard3').innerHTML = `
    <h4>Family & Profile</h4>
    <div class="detail-row"><div class="detail-label">Relation with Staff:</div><div class="detail-value">${customer[HEADER_RELATION_WITH_STAFF] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Wife/Husband Name:</div><div class="detail-value">${customer[HEADER_FAMILY_DETAILS_1] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Wife/Husband Job:</div><div class="detail-value">${customer[HEADER_FAMILY_DETAILS_2] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Children Names:</div><div class="detail-value">${customer[HEADER_FAMILY_DETAILS_3] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Children Details:</div><div class="detail-value">${customer[HEADER_FAMILY_DETAILS_4] || 'N/A'}</div></div>
    <div class="detail-row"><div class="detail-label">Status of Lead:</div><div class="detail-value">${customer[HEADER_PROFILE_OF_CUSTOMER] || 'N/A'}</div></div>
`;

    customerDetailsContent.style.display = 'grid'; // Ensure the grid layout is visible for details
}
// Function to calculate performance percentage
function calculatePerformance(actuals, targets) {
    const performance = {};
    for (const metric in targets) {
        const actual = actuals[metric] || 0;
        const target = targets[metric];
        if (target > 0) {
            performance[metric] = (actual / target) * 100;
        } else {
            performance[metric] = NaN; // Or 0, depending on how you want to handle no target
        }
    }
    return performance;
}
// Helper to determine progress bar class based on percentage
function getProgressBarClass(percentage) {
    if (percentage >= 100) return 'success';
    if (percentage >= 75) return 'warning-high';
    if (percentage >= 50) return 'warning-medium';
    if (percentage > 0) return 'warning-low';
    return 'danger';
}
// Function to render Branch Performance Report (d3.PNG)
function renderBranchPerformanceReport(branchName) {
    reportDisplay.innerHTML = `<h2>Branch Performance Report: ${branchName}</h2>`;
    
    const selectedMonthValue = monthSelect.value;
    const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);
    
    const branchActivityEntries = filteredData.filter(entry => entry[HEADER_BRANCH_NAME] === branchName);
    if (branchActivityEntries.length === 0) {
        reportDisplay.innerHTML += '<p>No activity found for this branch for the selected month.</p>';
        return;
    }

    const employeesInBranch = [...new Set(branchActivityEntries
        .map(entry => entry[HEADER_EMPLOYEE_CODE]))].sort((codeA, codeB) => {
                const nameA = employeeCodeToNameMap[codeA] || codeA;
                const nameB = employeeCodeToNameMap[codeB] || codeB;
                return nameA.localeCompare(nameB);
            });

    if (employeesInBranch.length === 0) {
        reportDisplay.innerHTML += '<p>No employee activity found for this branch for the selected month.</p>';
        return;
    }

    const branchPerformanceGrid = document.createElement('div');
    branchPerformanceGrid.className = 'branch-performance-grid';

    employeesInBranch.forEach(employeeCode => {
        const employeeActivities = branchActivityEntries.filter(entry => entry[HEADER_EMPLOYEE_CODE] === employeeCode);
        const { totalActivity } = calculateTotalActivity(employeeActivities); // Destructure
        const employeeDisplayName = employeeCodeToNameMap[employeeCode] || employeeCode; // Use name from map or code
        const designation = employeeCodeToDesignationMap[employeeCode] || 'Default';
        const targets = TARGETS[designation] || TARGETS['Default'];
        const performance = calculatePerformance(totalActivity, targets);

        const employeeCard = document.createElement('div');
        employeeCard.className = 'employee-performance-card';
        employeeCard.innerHTML = `
            <h4>${employeeDisplayName} (${designation})</h4>
            <div style="overflow-x: auto;">
                <table class="performance-table">
                    <thead>
                        <tr><th>Metric</th><th>Actual</th><th>Target</th><th>%</th></tr>
                    </thead>
                    <tbody>
                        ${Object.keys(targets).map(metric => {
                            const actualValue = totalActivity[metric] || 0;
                            const targetValue = targets[metric];
                            let percentValue = performance[metric]; // Raw numerical percentage
                            let displayPercent;
                            let progressWidth;

                            if (isNaN(percentValue) || targetValue === 0) { // Check for NaN or if target is 0
                                displayPercent = 'N/A';
                                progressWidth = 0;
                                progressBarClass = 'no-activity';
                            } else {
                                displayPercent = `${Math.round(percentValue)}%`; // Round to nearest whole number
                                progressWidth = Math.min(100, Math.round(percentValue)); // Round for width
                                progressBarClass = getProgressBarClass(percentValue); // Use original float for color
                            }
                            // Special handling for 0 actuals with positive targets
                            if (actualValue === 0 && targetValue > 0) {
                                displayPercent = '0%';
                                progressWidth = 0;
                                progressBarClass = 'danger'; // Red if 0% and target exists
                            }

                            return `
                                <tr>
                                    <td data-label="Metric">${metric}</td>
                                    <td data-label="Actual">${actualValue}</td>
                                    <td data-label="Target">${targetValue}</td>
                                    <td data-label="Achievement (%)">${displayPercent}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        branchPerformanceGrid.appendChild(employeeCard);
    });
    reportDisplay.appendChild(branchPerformanceGrid);
}

  // Function to render Employee Summary (d4.PNG)
function renderEmployeeSummary(employeeActivities) {
    reportDisplay.innerHTML = '<h2>Employee Performance Summary</h2>';
    if (!employeeActivities || employeeActivities.length === 0) {
        reportDisplay.innerHTML += '<p>No activities found for the selected employee in the selected month.</p>';
        return;
    }

    const employeeCode = employeeActivities[0][HEADER_EMPLOYEE_CODE];
    const employeeName = employeeCodeToNameMap[employeeCode] || employeeCode;
    const branchName = employeeActivities[0][HEADER_BRANCH_NAME];
    const designation = employeeCodeToDesignationMap[employeeCode] || 'Default';

    const { totalActivity, productInterests } = calculateTotalActivity(employeeActivities);
    const targets = TARGETS[designation] || TARGETS['Default'];
    const performance = calculatePerformance(totalActivity, targets);

    const summaryHtml = `
            <div class="employee-summary-header">
                <h3>${employeeName} (${employeeCode})</h3>
                <p>Branch: ${branchName} | Designation: ${designation}</p>
            </div>
            <div class="summary-details">
                <div class="summary-card">
                    <h4>Activity Summary</h4>
                    <table class="summary-table">
                        <thead>
                            <tr><th>Metric</th><th>Actual</th><th>Target</th><th>% Achieved</th></tr>
                        </thead>
                        <tbody>
                            ${Object.keys(targets).map(metric => {
                                const actualValue = totalActivity[metric] || 0;
                                const targetValue = targets[metric];
                                let percentValue = performance[metric];
                                let displayPercent;

                                if (isNaN(percentValue) || targetValue === 0) {
                                    displayPercent = 'N/A';
                                } else {
                                    displayPercent = `${Math.round(percentValue)}%`;
                                }
                                if (actualValue === 0 && targetValue > 0) {
                                    displayPercent = '0%';
                                }
                                return `<tr><td>${metric}</td><td>${actualValue}</td><td>${targetValue}</td><td>${displayPercent}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="summary-card">
                    <h4>Product Interests</h4>
                    <p>${productInterests.length > 0 ? productInterests.join(', ') : 'No product interests recorded.'}</p>
                </div>
            </div>
            <button class="btn download-btn" id="downloadEmployeeSummaryCSV" data-employee-code="${employeeCode}">Download Employee Summary CSV</button>
        `;
    reportDisplay.innerHTML = summaryHtml;

    // Add event listener for the download button inside the summary
    document.getElementById('downloadEmployeeSummaryCSV').addEventListener('click', (event) => {
        const empCode = event.target.dataset.employeeCode;
        downloadEmployeeSummaryCSV(empCode);
    });
}

// Function to download individual Employee Summary CSV
function downloadEmployeeSummaryCSV(employeeCode) {
    const selectedMonthValue = monthSelect.value;
    const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);

    const employeeActivities = filteredData.filter(entry =>
        entry[HEADER_EMPLOYEE_CODE] === employeeCode &&
        entry[HEADER_BRANCH_NAME] === branchSelect.value // Ensure consistent filtering
    );

    if (employeeActivities.length === 0) {
        displayMessage("No activities found for this employee in the selected month to download.", 'info');
        return;
    }

    const employeeName = employeeCodeToNameMap[employeeCode] || employeeCode;
    const branchName = employeeActivities[0][HEADER_BRANCH_NAME];
    const designation = employeeCodeToDesignationMap[employeeCode] || 'Default';

    const { totalActivity, productInterests } = calculateTotalActivity(employeeActivities);
    const targets = TARGETS[designation] || TARGETS['Default'];
    const performance = calculatePerformance(totalActivity, targets);

    const csvRows = [];
    // Header Row 1
    csvRows.push(`"Employee Name","${employeeName}"`);
    csvRows.push(`"Employee Code","${employeeCode}"`);
    csvRows.push(`"Branch","${branchName}"`);
    csvRows.push(`"Designation","${designation}"`);
    csvRows.push(`"Report Month", "${monthSelect.options[monthSelect.selectedIndex].text}"`); // Include selected month
    csvRows.push(''); // Empty line for separation

    // Activity Summary Table
    csvRows.push(`"Activity Summary"`);
    csvRows.push(`"Metric","Actual","Target","% Achieved"`);
    Object.keys(targets).forEach(metric => {
        const actualValue = totalActivity[metric] || 0;
        const targetValue = targets[metric];
        let percentValue = performance[metric];
        let displayPercent;

        if (isNaN(percentValue) || targetValue === 0) {
            displayPercent = 'N/A';
        } else {
            displayPercent = `${Math.round(percentValue)}%`;
        }
        if (actualValue === 0 && targetValue > 0) {
            displayPercent = '0%';
        }
        csvRows.push(`"${metric}",${actualValue},${targetValue},"${displayPercent}"`);
    });
    csvRows.push(''); // Empty line for separation

    // Product Interests
    csvRows.push(`"Product Interests"`);
    csvRows.push(`"${productInterests.length > 0 ? productInterests.join(', ') : 'No product interests recorded.'}"`);
    csvRows.push(''); // Empty line for separation

    // All Entries Table
    csvRows.push(`"All Canvassing Entries for ${employeeName} (${monthSelect.options[monthSelect.selectedIndex].text})"`);
    if (employeeActivities.length > 0) {
        let entryHeaders = Object.keys(employeeActivities[0]);
        // --- MODIFICATION START ---
        // Filter out sensitive headers if access is limited
        if (currentAccessLevel === 'limited_data_view') {
            entryHeaders = entryHeaders.filter(header => 
                header !== HEADER_PHONE_NUMBER_WHATSAPP && 
                header !== HEADER_ADDRESS
            );
        }
        // --- MODIFICATION END ---
        csvRows.push(entryHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',')); // Quote headers
        employeeActivities.forEach(entry => {
            const row = entryHeaders.map(header => {
                let cell = entry[header];
                // --- MODIFICATION START ---
                // Mask sensitive data in the cell if access is limited
                if (currentAccessLevel === 'limited_data_view') {
                    if (header === HEADER_PHONE_NUMBER_WHATSAPP) {
                        cell = maskPhoneNumber(cell);
                    } else if (header === HEADER_ADDRESS) {
                        cell = maskAddress(cell);
                    }
                }
                // --- MODIFICATION END ---
                const stringCell = String(cell || '');
                return `"${stringCell.replace(/"/g, '""')}"`;
            }).join(',');
            csvRows.push(row);
        });
    } else {
        csvRows.push(`"No detailed entries available for this employee in the selected month."`);
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${employeeName.replace(/\s+/g, '_')}_Summary_Report_${monthSelect.value}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        displayMessage(`Summary report for ${employeeName} downloaded successfully!`, 'success');
    } else {
        displayMessage("Your browser does not support automatic downloads. Please copy the data manually.", 'error');
        console.log(csvString);
    }
}

    // Function to render all entries (d2.PNG - detailed data table)
function renderAllEntries(entries, reportTitle = "All Canvassing Entries") {
    reportDisplay.innerHTML = `<h2>${reportTitle}</h2>`;
    if (entries.length === 0) {
        reportDisplay.innerHTML += '<p>No entries found for the selected filters.</p>';
        return;
    }

    const tableContainer = document.createElement('div');
    tableContainer.className = 'data-table-container'; // For horizontal scrolling
    const table = document.createElement('table');
    table.className = 'data-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    
    // Use all available headers from the first entry to create table headers
    const headers = Object.keys(entries[0]);
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    entries.forEach(entry => {
        const row = tbody.insertRow();
        headers.forEach(header => {
            const cell = row.insertCell();
            let displayValue = entry[header];

            // --- MODIFICATION START ---
            if (currentAccessLevel === 'limited_data_view') {
                if (header === HEADER_PHONE_NUMBER_WHATSAPP) {
                    displayValue = maskPhoneNumber(displayValue);
                } else if (header === HEADER_ADDRESS) {
                    displayValue = maskAddress(displayValue);
                }
            }
            // --- MODIFICATION END ---

            cell.textContent = displayValue;
            cell.setAttribute('data-label', header); // For mobile responsiveness
        });
    });
    tableContainer.appendChild(table);
    reportDisplay.appendChild(tableContainer);
}

// Helper function to mask phone numbers (re-added for clarity, assumed existing)
function maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return 'N/A';
    if (phoneNumber.length <= 4) return '***'; // Mask short numbers fully
    return '***' + phoneNumber.slice(-4);
}

// Helper function to mask addresses (re-added for clarity, assumed existing)
function maskAddress(address) {
    if (!address) return 'N/A';
    // Simple masking: replace most characters with asterisks
    return address.replace(/./g, '*');
}
    
// --- Detailed Customer View Tab and Functionality ---
customerViewBranchSelect.addEventListener('change', () => {
    const selectedBranch = customerViewBranchSelect.value;
    const selectedMonthValue = customerViewMonthSelect.value;
    
    // Filter by month first
    let filteredByMonthData = filterDataByMonth(allCanvassingData, selectedMonthValue);

    if (selectedBranch) {
        // Populate employee dropdown for the selected branch from filtered (by month) data
        const employeesInBranch = [...new Set(filteredByMonthData
            .filter(entry => entry[HEADER_BRANCH_NAME] === selectedBranch)
            .map(entry => entry[HEADER_EMPLOYEE_CODE]))];

        const sortedEmployeeCodesInBranch = [...employeesInBranch].sort((codeA, codeB) => {
            const nameA = employeeCodeToNameMap[codeA] || codeA;
            const nameB = employeeCodeToNameMap[codeB] || codeB;
            return nameA.localeCompare(nameB);
        });
        populateDropdown(customerViewEmployeeSelect, sortedEmployeeCodesInBranch, true);
        customerViewEmployeeSelect.value = ''; // Reset employee selection
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select an employee to load customer data.</td></tr>';
        customerDetailsContent.style.display = 'none'; // Hide details when branch changes
    } else {
        customerViewEmployeeSelect.innerHTML = '<option value="">-- Select an Employee --</option>'; // Clear employee dropdown
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select a branch and employee to load customer data.</td></tr>';
        customerDetailsContent.style.display = 'none';
    }
});

// Load customer data button
document.getElementById('loadCustomerDataBtn').addEventListener('click', loadDetailedCustomerReport);

function loadDetailedCustomerReport() {
    const selectedBranch = customerViewBranchSelect.value;
    const selectedEmployeeCode = customerViewEmployeeSelect.value;
    const selectedMonthValue = customerViewMonthSelect.value;

    if (!selectedBranch || !selectedEmployeeCode || !selectedMonthValue) {
        displayMessage("Please select a branch, an employee, and a month to load customer data.", 'error');
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Please select a branch, an employee, and a month to load customer data.</td></tr>';
        customerDetailsContent.style.display = 'none';
        return;
    }

    // Filter by month first, then by branch and employee
    const filteredByMonth = filterDataByMonth(allCanvassingData, selectedMonthValue);

    const customerEntries = filteredByMonth.filter(entry =>
        entry[HEADER_BRANCH_NAME] === selectedBranch &&
        entry[HEADER_EMPLOYEE_CODE] === selectedEmployeeCode &&
        entry[HEADER_PROSPECT_NAME] && entry[HEADER_PROSPECT_NAME].trim() !== '' // Ensure prospect name exists
    );

    if (customerEntries.length === 0) {
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">No detailed customer entries found for the selected employee and month.</td></tr>';
        customerDetailsContent.style.display = 'none';
        return;
    }

    detailedCustomerReportTableBody.innerHTML = ''; // Clear previous entries

    customerEntries.forEach(entry => {
        const row = detailedCustomerReportTableBody.insertRow();
        row.insertCell().textContent = entry[HEADER_PROSPECT_NAME];

        // --- MODIFICATION START ---
        const displayPhoneNumber = (currentAccessLevel === 'limited_data_view') ? maskPhoneNumber(entry[HEADER_PHONE_NUMBER_WHATSAPP]) : (entry[HEADER_PHONE_NUMBER_WHATSAPP] || 'N/A');
        row.insertCell().textContent = displayPhoneNumber;
        // --- MODIFICATION END ---

        row.insertCell().textContent = entry[HEADER_ACTIVITY_TYPE];
        row.insertCell().textContent = formatDate(entry[HEADER_TIMESTAMP]); // Format date for display
        
        const viewDetailsCell = row.insertCell();
        const viewDetailsBtn = document.createElement('button');
        viewDetailsBtn.textContent = 'View Details';
        viewDetailsBtn.className = 'btn-small';
        viewDetailsBtn.onclick = () => showCustomerDetails(entry);
        viewDetailsCell.appendChild(viewDetailsBtn);
    });
    displayMessage("Customer data loaded successfully!", 'success');
    customerDetailsContent.style.display = 'none'; // Hide details until a customer is selected
}

function showCustomerDetails(entry) {
    document.getElementById('currentCustomerName').textContent = entry[HEADER_PROSPECT_NAME] || 'N/A'; // Added || 'N/A' for safety

    // --- MODIFICATION START ---
    const displayPhoneNumber = (currentAccessLevel === 'limited_data_view') ? maskPhoneNumber(entry[HEADER_PHONE_NUMBER_WHATSAPP]) : (entry[HEADER_PHONE_NUMBER_WHATSAPP] || 'N/A');
    const displayAddress = (currentAccessLevel === 'limited_data_view') ? maskAddress(entry[HEADER_ADDRESS]) : (entry[HEADER_ADDRESS] || 'N/A');
    // --- MODIFICATION END ---

    // --- NEW: Populate Employee & Branch Info section ---
    // Ensure you have a div with id="employeeBranchInfo" in your HTML as instructed previously
    const employeeBranchInfoDiv = document.getElementById('employeeBranchInfo');
    if (employeeBranchInfoDiv) { // Check if the element exists
        employeeBranchInfoDiv.innerHTML = `
            <h3>Employee & Branch Info</h3>
            <div class="detail-row">
                <div class="detail-label">Employee Name:</div>
                <div class="detail-value">${entry[HEADER_EMPLOYEE_NAME] || 'N/A'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Branch Name:</div>
                <div class="detail-value">${entry[HEADER_BRANCH_NAME] || 'N/A'}</div>
            </div>
        `;
    }
    // --- END NEW ---

    // Update existing card content to use the detail-row structure for consistency and null checks
    customerCard1.innerHTML = `
        <h4>Contact & Basic Info</h4>
        <div class="detail-row"><div class="detail-label">Phone:</div><div class="detail-value">${displayPhoneNumber}</div></div>
        <div class="detail-row"><div class="detail-label">Address:</div><div class="detail-value">${displayAddress}</div></div>
        <div class="detail-row"><div class="detail-label">Profession:</div><div class="detail-value">${entry[HEADER_PROFESSION] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">DOB/WD:</div><div class="detail-value">${formatDate(entry[HEADER_DOB_WD]) || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Relation with Staff:</div><div class="detail-value">${entry[HEADER_RELATION_WITH_STAFF] || 'N/A'}</div></div>
    `;
    customerCard2.innerHTML = `
        <h4>Activity & Interests</h4>
        <div class="detail-row"><div class="detail-label">Activity Type:</div><div class="detail-value">${entry[HEADER_ACTIVITY_TYPE] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Date:</div><div class="detail-value">${formatDate(entry[HEADER_TIMESTAMP]) || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Type of Customer:</div><div class="detail-value">${entry[HEADER_TYPE_OF_CUSTOMER] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Lead Source:</div><div class="detail-value">${entry[HEADER_R_LEAD_SOURCE] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">How Contacted:</div><div class="detail-value">${entry[HEADER_HOW_CONTACTED] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Product Interested:</div><div class="detail-value">${entry[HEADER_PRODUCT_INTERESTED] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Remarks:</div><div class="detail-value">${entry[HEADER_REMARKS] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Next Follow-up:</div><div class="detail-value">${formatDate(entry[HEADER_NEXT_FOLLOW_UP_DATE]) || 'N/A'}</div></div>
    `;
    customerCard3.innerHTML = `
        <h4>Family & Profile</h4>
        <div class="detail-row"><div class="detail-label">Wife/Husband Name:</div><div class="detail-value">${entry[HEADER_FAMILY_DETAILS_1] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Wife/Husband Job:</div><div class="detail-value">${entry[HEADER_FAMILY_DETAILS_2] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Children Names:</div><div class="detail-value">${entry[HEADER_FAMILY_DETAILS_3] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Children Details:</div><div class="detail-value">${entry[HEADER_FAMILY_DETAILS_4] || 'N/A'}</div></div>
        <div class="detail-row"><div class="detail-label">Profile of Customer:</div><div class="detail-value">${entry[HEADER_PROFILE_OF_CUSTOMER] || 'N/A'}</div></div>
    `;

    // --- Recommended Change: Set display to 'grid' for consistency ---
    customerDetailsContent.style.display = 'grid'; // Changed from 'flex' to 'grid'
    customerDetailsContent.scrollIntoView({ behavior: 'smooth' }); // Scroll to view
}
document.getElementById('downloadDetailedCustomerReportBtn').addEventListener('click', downloadDetailedCustomerReport);

function downloadDetailedCustomerReport() {
    const selectedBranch = customerViewBranchSelect.value;
    const selectedEmployeeCode = customerViewEmployeeSelect.value;
    const selectedMonthValue = customerViewMonthSelect.value;


    if (!selectedBranch || !selectedEmployeeCode || !selectedMonthValue) {
        displayMessage("Please select a branch, an employee, and a month to download the report.", 'error');
        return;
    }
    
    // Filter by month first
    const filteredByMonth = filterDataByMonth(allCanvassingData, selectedMonthValue);

    const customerEntries = filteredByMonth.filter(entry =>
        entry[HEADER_BRANCH_NAME] === selectedBranch &&
        entry[HEADER_EMPLOYEE_CODE] === selectedEmployeeCode &&
        entry[HEADER_PROSPECT_NAME] && entry[HEADER_PROSPECT_NAME].trim() !== ''
    );

    if (customerEntries.length === 0) {
        displayMessage("No detailed customer entries found for the selected filters to download.", 'info');
        return;
    }

    const employeeNameForFile = employeeCodeToNameMap[selectedEmployeeCode] || selectedEmployeeCode;
    const branchNameForFile = selectedBranch.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize branch name for filename
    const monthNameForFile = customerViewMonthSelect.options[customerViewMonthSelect.selectedIndex].text.replace(/\s+/g, '_');


    const headers = [
        HEADER_TIMESTAMP, HEADER_DATE, HEADER_BRANCH_NAME, HEADER_EMPLOYEE_NAME, HEADER_EMPLOYEE_CODE,
        HEADER_DESIGNATION, HEADER_ACTIVITY_TYPE, HEADER_TYPE_OF_CUSTOMER, HEADER_R_LEAD_SOURCE,
        HEADER_HOW_CONTACTED, HEADER_PROSPECT_NAME, HEADER_PHONE_NUMBER_WHATSAPP, HEADER_ADDRESS,
        HEADER_PROFESSION, HEADER_DOB_WD, HEADER_PRODUCT_INTERESTED, HEADER_REMARKS,
        HEADER_NEXT_FOLLOW_UP_DATE, HEADER_RELATION_WITH_STAFF, HEADER_FAMILY_DETAILS_1,
        HEADER_FAMILY_DETAILS_2, HEADER_FAMILY_DETAILS_3, HEADER_FAMILY_DETAILS_4, HEADER_PROFILE_OF_CUSTOMER
    ];

    let csvContent = headers.map(header => `"${header.replace(/"/g, '""')}"`).join(',') + '\n';

    customerEntries.forEach(entry => {
        const row = headers.map(header => {
            let cell = entry[header]; // Use let for modification

            // --- MODIFICATION START ---
            if (currentAccessLevel === 'limited_data_view') {
                if (header === HEADER_PHONE_NUMBER_WHATSAPP) {
                    cell = maskPhoneNumber(cell);
                } else if (header === HEADER_ADDRESS) {
                    cell = maskAddress(cell);
                }
            }
            // --- MODIFICATION END ---

            const stringCell = String(cell || '');
            return `"${stringCell.replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${branchNameForFile}_${employeeNameForFile}_Customer_Report_${monthNameForFile}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    displayMessage("Detailed Customer Report downloaded successfully!", 'success');
}

// --- Tab Switching Logic (Re-factored) ---
// Make sure 'reportsSection' and 'detailedCustomerViewSection' are properly defined in your HTML and script
function showTab(tabId) {
    // Hide all sections first
    reportsSection.style.display = 'none';
    detailedCustomerViewSection.style.display = 'none';
    employeeManagementSection.style.display = 'none';

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show the selected section and activate its button
    let activeSection;
    let activeTabButton;

    if (tabId === 'allBranchSnapshotTabBtn' || tabId === 'allStaffOverallPerformanceTabBtn' ||
        tabId === 'nonParticipatingBranchesTabBtn' || tabId === 'branchPerformanceTabBtn' ||
        tabId === 'performanceSummaryTabBtn' || tabId === 'downloadOverallStaffPerformanceReportBtn') {
        activeSection = reportsSection;
        activeTabButton = document.getElementById(tabId);
    } else if (tabId === 'detailedCustomerViewTabBtn') {
        activeSection = detailedCustomerViewSection;
        activeTabButton = document.getElementById(tabId);
    } else if (tabId === 'employeeManagementTabBtn') {
        activeSection = employeeManagementSection;
        activeTabButton = document.getElementById(tabId);
    }

    if (activeSection) {
        activeSection.style.display = 'block';
    }
    if (activeTabButton) {
        activeTabButton.classList.add('active');
    }

    // Reset branch/employee selections and display based on tab
    if (tabId === 'detailedCustomerViewTabBtn') {
        // Customer view has its own filters, ensure they are reset or correctly set
        customerViewBranchSelect.value = '';
        customerViewEmployeeSelect.innerHTML = '<option value="">-- Select an Employee --</option>';
        detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select a branch, employee, and month to load customer data.</td></tr>';
        customerDetailsContent.style.display = 'none';
        // Ensure the month dropdown for customer view is populated and reflects current month
        populateMonthDropdowns(); // Re-populate to ensure current month is selected
        document.getElementById('currentCustomerName').textContent = ''; // Clear customer name
    } else if (tabId === 'employeeManagementTabBtn') {
        // Employee management tab doesn't rely on data filters, just populate employee dropdowns
        populateDropdown(newBranchNameInput, PREDEFINED_BRANCHES);
        populateDropdown(bulkEmployeeBranchNameInput, PREDEFINED_BRANCHES);
        employeeManagementMessage.style.display = 'none'; // Hide messages
    } else { // For all reports tabs
        branchSelect.value = ''; // Clear main branch filter
        employeeSelect.innerHTML = '<option value="">-- Select an Employee --</option>'; // Clear main employee filter
        employeeFilterPanel.style.display = 'none';
        viewOptions.style.display = 'none';
        // Ensure the month dropdown for main reports is populated and reflects current month
        populateMonthDropdowns(); // Re-populate to ensure current month is selected
        // Initial render based on the tab
        if (tabId === 'allBranchSnapshotTabBtn') {
            renderAllBranchSnapshot();
        } else if (tabId === 'allStaffOverallPerformanceTabBtn') {
            renderOverallStaffPerformanceReport();
        } else if (tabId === 'nonParticipatingBranchesTabBtn') {
            renderNonParticipatingBranches();
        } else if (tabId === 'branchPerformanceTabBtn') {
            reportDisplay.innerHTML = '<p>Please select a branch and a month to view the Branch Performance Report.</p>';
        } else if (tabId === 'performanceSummaryTabBtn') {
            reportDisplay.innerHTML = '<p>Please select a branch, an employee, and a month to view the Performance Summary.</p>';
        }
    }
}

   // --- Event Listeners for Tab Buttons ---
if (allBranchSnapshotTabBtn) {
    allBranchSnapshotTabBtn.addEventListener('click', () => {
        showTab('allBranchSnapshotTabBtn');
    });
}
    
if (allStaffOverallPerformanceTabBtn) {
    allStaffOverallPerformanceTabBtn.addEventListener('click', () => {
        showTab('allStaffOverallPerformanceTabBtn');
        renderOverallStaffPerformanceReport(); // Render with current month/year selected by default
    });
}

if (nonParticipatingBranchesTabBtn) {
    nonParticipatingBranchesTabBtn.addEventListener('click', () => {
        showTab('nonParticipatingBranchesTabBtn');
        renderNonParticipatingBranches(); // Render with current month/year selected by default
    });
}

if (branchPerformanceTabBtn) {
    branchPerformanceTabBtn.addEventListener('click', () => {
        showTab('branchPerformanceTabBtn');
    });
}
    
if (detailedCustomerViewTabBtn) {
    detailedCustomerViewTabBtn.addEventListener('click', () => {
        showTab('detailedCustomerViewTabBtn');
    });
}

if (employeeManagementTabBtn) {
    employeeManagementTabBtn.addEventListener('click', () => {
        showTab('employeeManagementTabBtn');
    });
}

// --- Event Listeners for View Option Buttons (inside reportsSection) ---
if (viewBranchPerformanceReportBtn) {
    viewBranchPerformanceReportBtn.addEventListener('click', () => {
        document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        viewBranchPerformanceReportBtn.classList.add('active');
        const selectedBranch = branchSelect.value;
        if (selectedBranch) {
            renderBranchPerformanceReport(selectedBranch);
        } else {
            displayMessage("Please select a branch first.", 'error');
        }
    });
}

if (viewEmployeeSummaryBtn) {
    viewEmployeeSummaryBtn.addEventListener('click', () => {
        document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        viewEmployeeSummaryBtn.classList.add('active');
        const selectedEmployee = employeeSelect.value;
        if (selectedEmployee) {
            const selectedMonthValue = monthSelect.value;
            const filteredByMonth = filterDataByMonth(allCanvassingData, selectedMonthValue);
            const employeeActivities = filteredByMonth.filter(entry =>
                entry[HEADER_EMPLOYEE_CODE] === selectedEmployee &&
                entry[HEADER_BRANCH_NAME] === branchSelect.value // Ensure branch filter is also applied
            );
            renderEmployeeSummary(employeeActivities);
        } else {
            displayMessage("Please select an employee first.", 'error');
        }
    });
}

if (viewAllEntriesBtn) {
    viewAllEntriesBtn.addEventListener('click', () => {
        document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        viewAllEntriesBtn.classList.add('active');
        const selectedBranch = branchSelect.value;
        const selectedEmployee = employeeSelect.value;
        const selectedMonthValue = monthSelect.value;

        let entriesToDisplay = filterDataByMonth(allCanvassingData, selectedMonthValue);

        if (selectedBranch) {
            entriesToDisplay = entriesToDisplay.filter(entry => entry[HEADER_BRANCH_NAME] === selectedBranch);
        }
        if (selectedEmployee) {
            entriesToDisplay = entriesToDisplay.filter(entry => entry[HEADER_EMPLOYEE_CODE] === selectedEmployee);
        }
        let title = "All Canvassing Entries";
        if (selectedBranch && selectedEmployee) {
            title = `All Entries for ${employeeCodeToNameMap[selectedEmployee] || selectedEmployee} at ${selectedBranch}`;
        } else if (selectedBranch) {
            title = `All Entries for ${selectedBranch}`;
        } else if (selectedEmployee) {
             title = `All Entries for ${employeeCodeToNameMap[selectedEmployee] || selectedEmployee}`;
        }
        renderAllEntries(entriesToDisplay, title);
    });
}

if (viewPerformanceReportBtn) {
    viewPerformanceReportBtn.addEventListener('click', () => {
        document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        viewPerformanceReportBtn.classList.add('active');
        // This button's function is unclear from previous context.
        // Assuming it might be for a general performance view or a redundant one.
        // For now, if branch and employee selected, show employee summary. Else, show overall.
        const selectedBranch = branchSelect.value;
        const selectedEmployee = employeeSelect.value;
        if (selectedBranch && selectedEmployee) {
            const selectedMonthValue = monthSelect.value;
            const filteredByMonth = filterDataByMonth(allCanvassingData, selectedMonthValue);
            const employeeActivities = filteredByMonth.filter(entry =>
                entry[HEADER_EMPLOYEE_CODE] === selectedEmployee &&
                entry[HEADER_BRANCH_NAME] === selectedBranch
            );
            renderEmployeeSummary(employeeActivities);
        } else {
            renderOverallStaffPerformanceReport();
        }
    });
}

if (viewBranchVisitLeaderboardBtn) {
    viewBranchVisitLeaderboardBtn.addEventListener('click', () => {
        document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        viewBranchVisitLeaderboardBtn.classList.add('active');
        renderLeaderboard('Visit');
    });
}

if (viewBranchCallLeaderboardBtn) {
    viewBranchCallLeaderboardBtn.addEventListener('click', () => {
        document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        viewBranchCallLeaderboardBtn.classList.add('active');
        renderLeaderboard('Call');
    });
}

if (viewStaffParticipationBtn) {
    viewStaffParticipationBtn.addEventListener('click', () => {
        document.querySelectorAll('.view-options .btn').forEach(btn => btn.classList.remove('active'));
        viewStaffParticipationBtn.classList.add('active');
        renderStaffParticipation();
    });
}

// Leaderboard function (for d5.PNG & d6.PNG) - now takes metric as argument
function renderLeaderboard(metricType) {
    reportDisplay.innerHTML = `<h2>Branch ${metricType} Leaderboard</h2>`;

    const selectedMonthValue = monthSelect.value;
    const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);

    // Group data by branch and calculate total activity for the given metric
    const branchActivityTotals = {};
    filteredData.forEach(entry => {
        const branch = entry[HEADER_BRANCH_NAME];
        const activityType = entry[HEADER_ACTIVITY_TYPE];
        
        // Map activity type from raw data to normalized metric name
        let normalizedActivityType = '';
        if (activityType) {
            if (activityType.trim().toLowerCase() === 'visit') {
                normalizedActivityType = 'Visit';
            } else if (activityType.trim().toLowerCase() === 'calls') {
                normalizedActivityType = 'Call';
            }
        }

        if (normalizedActivityType === metricType) {
            if (!branchActivityTotals[branch]) {
                branchActivityTotals[branch] = 0;
            }
            branchActivityTotals[branch]++;
        }
    });

    // Convert to array and sort for leaderboard
    const sortedBranches = Object.entries(branchActivityTotals).sort(([, countA], [, countB]) => countB - countA);

    if (sortedBranches.length === 0) {
        reportDisplay.innerHTML += `<p>No ${metricType} activity recorded for the selected month.</p>`;
        return;
    }

    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headerRow.insertCell().textContent = 'Rank';
    headerRow.insertCell().textContent = 'Branch';
    headerRow.insertCell().textContent = `Total ${metricType}`;
    
    const tbody = table.createTBody();
    sortedBranches.forEach(( [branch, count], index) => {
        const row = tbody.insertRow();
        row.insertCell().textContent = index + 1;
        row.insertCell().textContent = branch;
        row.insertCell().textContent = count;
    });
    reportDisplay.appendChild(table);
}

// Staff Participation (d7.PNG)
function renderStaffParticipation() {
    reportDisplay.innerHTML = `<h2>Staff Participation</h2>`;

    const selectedMonthValue = monthSelect.value;
    const filteredData = filterDataByMonth(allCanvassingData, selectedMonthValue);

    // Map to store {employeeCode: {name, branch, designation, hasActivity: true/false}}
    const employeeParticipation = {};

    // Initialize all unique employees from our combined list
    allUniqueEmployees.forEach(empCode => {
        employeeParticipation[empCode] = {
            name: employeeCodeToNameMap[empCode] || empCode,
            branch: allCanvassingData.find(entry => entry[HEADER_EMPLOYEE_CODE] === empCode)?.[HEADER_BRANCH_NAME] || 'N/A',
            designation: employeeCodeToDesignationMap[empCode] || 'Default',
            hasActivity: false // Assume no activity initially
        };
    });

    // Mark employees with activity in the filtered data
    filteredData.forEach(entry => {
        const empCode = entry[HEADER_EMPLOYEE_CODE];
        if (employeeParticipation[empCode]) {
            employeeParticipation[empCode].hasActivity = true;
        }
    });

    // Convert to array and sort
    const sortedParticipation = Object.values(employeeParticipation).sort((a, b) => a.name.localeCompare(b.name));

    if (sortedParticipation.length === 0) {
        reportDisplay.innerHTML += '<p>No staff participation data available for the selected month.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    ['Employee Name', 'Branch', 'Designation', 'Participated (This Month)'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    sortedParticipation.forEach(emp => {
        const row = tbody.insertRow();
        row.insertCell().textContent = emp.name;
        row.insertCell().textContent = emp.branch;
        row.insertCell().textContent = emp.designation;
        const statusCell = row.insertCell();
        statusCell.textContent = emp.hasActivity ? 'Yes' : 'No';
        statusCell.classList.add(emp.hasActivity ? 'status-yes' : 'status-no');
    });
    reportDisplay.appendChild(table);
}
    
// Employee Management Tab Functions
async function sendDataToGoogleAppsScript(action, data) {
    displayEmployeeManagementMessage('Processing request...', false); // Info message
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'cors', // Required for cross-origin requests
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, data })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        if (result.status === 'SUCCESS') {
            displayEmployeeManagementMessage(result.message || 'Operation successful!', false);
            // After successful operation, re-process data to refresh dropdowns
            await processData(); // Re-fetch all data to ensure latest state
            // Re-render the active tab if applicable
            const currentActiveTab = document.querySelector('.tab-button.active');
            if (currentActiveTab) {
                showTab(currentActiveTab.id);
            } else {
                   // If no tab is active, default to allBranchSnapshot
                 showTab('allBranchSnapshotTabBtn');
            }

            return true;
        } else {
            displayEmployeeManagementMessage(result.message || 'Operation failed!', true);
            return false;
        }
    } catch (error) {
        console.error('Error sending data to Apps Script:', error);
        displayEmployeeManagementMessage(`Error: ${error.message}`, true);
        return false;
    }
}
    
// Add Employee
if (addEmployeeForm) {
    addEmployeeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newEmployeeName = newEmployeeNameInput.value.trim();
        const newEmployeeCode = newEmployeeCodeInput.value.trim();
        const newBranchName = newBranchNameInput.value;
        const newDesignation = newDesignationInput.value;

        if (!newEmployeeName || !newEmployeeCode || !newBranchName || !newDesignation) {
            displayEmployeeManagementMessage('All fields are required for adding an employee.', true);
            return;
        }

        const addData = {
            [HEADER_EMPLOYEE_NAME]: newEmployeeName,
            [HEADER_EMPLOYEE_CODE]: newEmployeeCode,
            [HEADER_BRANCH_NAME]: newBranchName,
            [HEADER_DESIGNATION]: newDesignation
        };
        const success = await sendDataToGoogleAppsScript('add_employee', addData);

        if (success) {
            addEmployeeForm.reset();
        }
    });
}

// Bulk Add Employees
if (bulkAddEmployeeForm) {
    bulkAddEmployeeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const bulkBranchName = bulkEmployeeBranchNameInput.value;
        const bulkDetails = bulkEmployeeDetailsTextarea.value.trim();

        if (!bulkBranchName || !bulkDetails) {
            displayEmployeeManagementMessage('Branch and employee details are required for bulk addition.', true);
            return;
        }

        const employees = bulkDetails.split('\n').map(line => {
            const [name, code, designation] = line.split(',').map(s => s.trim());
            if (name && code && designation) {
                return {
                    [HEADER_EMPLOYEE_NAME]: name,
                    [HEADER_EMPLOYEE_CODE]: code,
                    [HEADER_DESIGNATION]: designation,
                    [HEADER_BRANCH_NAME]: bulkBranchName // Assign the selected branch to all bulk employees
                };
            }
            return null;
        }).filter(employee => employee !== null);

        if (employees.length === 0) {
            displayEmployeeManagementMessage('No valid employee data found in bulk input.', true);
            return;
        }

        const success = await sendDataToGoogleAppsScript('bulk_add_employees', { employees: employees });

        if (success) {
            bulkAddEmployeeForm.reset();
        }
    });
}

// Delete Employee
if (deleteEmployeeForm) {
    deleteEmployeeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const employeeCodeToDelete = deleteEmployeeCodeInput.value.trim();

        if (!employeeCodeToDelete) {
            displayEmployeeManagementMessage('Employee Code is required for deletion.', true);
            return;
        }

        const deleteData = { [HEADER_EMPLOYEE_CODE]: employeeCodeToDelete };
        const success = await sendDataToGoogleAppsScript('delete_employee', deleteData);

        if (success) {
            deleteEmployeeForm.reset();
        }
    });
}

// --- NEW: Event Listener for "All Staff Performance (Overall)" tab button ---
//const allStaffOverallPerformanceTabBtn = document.getElementById('allStaffOverallPerformanceTabBtn');
if (allStaffOverallPerformanceTabBtn) {
    allStaffOverallPerformanceTabBtn.addEventListener('click', () => {
        showTab('allStaffOverallPerformanceTabBtn');
        renderOverallStaffPerformanceReport();
    });
}

// NEW: Event Listener for "Download Overall Staff Performance CSV" button
if (downloadOverallStaffPerformanceReportBtn) { // This variable is correct
    // CORRECTED LINE: Ensure this matches the declaration at the top
    downloadOverallStaffPerformanceReportBtn.addEventListener('click', () => { 
        downloadOverallStaffPerformanceReportCSV();
    });
}
detailedCustomerViewTabBtn.addEventListener('click', () => {
    // Ensure the dropdowns are populated and then load the report
    // This will only happen if currentAccessLevel is 'full' due to applyAccessRestrictions
    if (currentAccessLevel === 'full') {
        // Update the employee dropdown for the detailed customer view based on the current branch and month selection.
        // This is crucial to ensure the employee list is fresh when the tab is opened.
        updateCustomerViewEmployeeDropdown();
        
        // Only try to load the report if both branch and employee are selected
        const selectedBranch = customerViewBranchSelect.value;
        const selectedEmployee = customerViewEmployeeSelect.value;
        if (selectedBranch && selectedEmployee) {
            loadDetailedCustomerReport();
        } else {
            // Display a message if branch or employee is not yet selected
            detailedCustomerReportTableBody.innerHTML = '<tr><td colspan="5">Select a branch and an employee to load customer data.</td></tr>';
            customerDetailsContent.style.display = 'none';
        }
    }
});
// --- END NEW ---
// --- NEW: Event Listener for "Detailed Customer View" tab button ---
if (detailedCustomerViewTabBtn) {
    detailedCustomerViewTabBtn.addEventListener('click', () => {
        showTab('detailedCustomerViewTabBtn'); // This activates the tab content

        // Optional: You might want to automatically load the initial list
        // of customers when this tab is clicked, especially if no filters
        // are yet applied. You can call loadDetailedCustomerReport() here.
        // However, ensure it handles initial empty filters gracefully.
        // For now, it will load when filters are applied using dropdowns.
    });
}
// NEW FUNCTION: This updates the "Employee" dropdown for "Detailed Customer View"
function updateCustomerViewEmployeeDropdown() {
    const selectedBranch = customerViewBranchSelect.value;
    const selectedMonthValue = customerViewMonthSelect.value;

    if (selectedBranch) {
        // First, filter all data by the selected month
        let filteredByMonthData = filterDataByMonth(allCanvassingData, selectedMonthValue);

        // Then, get only employees from that month's data for the selected branch
        const employeeCodesInBranchFromCanvassing = filteredByMonthData
            .filter(entry => entry[HEADER_BRANCH_NAME] === selectedBranch)
            .map(entry => entry[HEADER_EMPLOYEE_CODE]);

        // Get unique employee codes and sort them
        const combinedEmployeeCodes = new Set([
            ...employeeCodesInBranchFromCanvassing
        ]);
        const sortedEmployeeCodesInBranch = [...combinedEmployeeCodes].sort((codeA, codeB) => {
            const nameA = employeeCodeToNameMap[codeA] || codeA;
            const nameB = employeeCodeToNameMap[codeB] || codeB;
            return nameA.localeCompare(nameB);
        });

        // Populate the specific employee dropdown for "Detailed Customer View"
        populateDropdown(customerViewEmployeeSelect, sortedEmployeeCodesInBranch, true);
        // Reset the employee selection after branch or month changes
        customerViewEmployeeSelect.value = "";
    } else {
        // If no branch is selected, clear the employee dropdown
        customerViewEmployeeSelect.innerHTML = '<option value="">-- Select --</option>';
        customerViewEmployeeSelect.value = "";
    }
}
    // Initial data fetch and tab display when the page loads
    processData();
    showTab('allBranchSnapshotTabBtn');
}); // This is the closing brace for DOMContentLoaded