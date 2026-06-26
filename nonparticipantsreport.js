document.addEventListener('DOMContentLoaded', () => {
    // URL for the MasterEmployees CSV (from your Google Sheet published to web)
    const masterEmployeesCSVUrl = 'https://docs.google.com/spreadsheets/d/1Za1CrlzzXpQjB3yZHjL2ZpRkjXgkVmLHH_LtXJq9K5o/export?format=csv&gid=2120288173';

    // Get references to the new HTML elements for Visit Non-Participants
    const downloadNonParticipantsInVisitBtn = document.getElementById('downloadNonParticipantsInVisitBtn');
    const nonParticipantsInVisitDisplay = document.getElementById('nonParticipantsInVisitDisplay');
    const nonParticipantsInVisitTableBody = document.querySelector('#nonParticipantsInVisitTable tbody');
    const nonParticipantsInVisitMessage = document.getElementById('nonParticipantsInVisitMessage');

    // Get references to the new HTML elements for Call Non-Participants
    const downloadNonParticipantsInCallBtn = document.getElementById('downloadNonParticipantsInCallBtn');
    const nonParticipantsInCallDisplay = document.getElementById('nonParticipantsInCallDisplay');
    const nonParticipantsInCallTableBody = document.querySelector('#nonParticipantsInCallTable tbody');
    const nonParticipantsInCallMessage = document.getElementById('nonParticipantsInCallMessage');

    const nonParticipantReportTabBtn = document.getElementById('nonParticipantReportTabBtn');
    const mainNonParticipantsMessage = document.getElementById('nonParticipantsMessage'); // Main message area

    let masterEmployeesData = []; // To store all employees from the master list
    let nonParticipatingInVisitEmployees = []; // Filtered non-participants in visits
    let nonParticipatingInCallEmployees = []; // Filtered non-participants in calls

    // Helper function to get the current month in YYYY-MM format
    function getCurrentMonthYear() {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
        return `${year}-${month}`;
    }

    // Helper function to filter canvassing data by month
    // Assumes 'Date' is a column in the data, formatted as 'dd/mm/yyyy'
    function filterCanvassingDataByMonth(data, targetMonth) {
        console.log(`[filterCanvassingDataByMonth] Target Month: ${targetMonth}`);
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.warn("[filterCanvassingDataByMonth] No data provided or data is empty.");
            return [];
        }
        const filteredData = data.filter(entry => {
            // Changed from 'Activity Date' to 'Date' based on user feedback
            const activityDate = entry['Date']; 

            if (activityDate === undefined) {
                // This warning should ideally not show if the 'Date' header is correct
                console.warn(`[filterCanvassingDataByMonth] 'Date' is undefined for an entry. This means the column might be missing or misnamed, or empty for this row.
                Example entry causing 'Date' to be undefined:`, entry);
                return false; 
            }

            if (typeof activityDate === 'string') {
                const parts = activityDate.split('/');
                // console.log(`[filterCanvassingDataByMonth] Date parts for "${activityDate}": ${JSON.stringify(parts)}`); 

                if (parts.length === 3) {
                    const month = parts[1]; 
                    const year = parts[2]; 
                    const entryMonthYear = `${year}-${month}`;
                    // console.log(`[filterCanvassingDataByMonth] Constructed YYYY-MM from entry: "${entryMonthYear}" vs Target: "${targetMonth}". Match: ${entryMonthYear === targetMonth}`); 
                    return entryMonthYear === targetMonth;
                } else {
                    console.warn(`[filterCanvassingDataByMonth] Malformed date format for entry: "${activityDate}". Expected dd/mm/yyyy but split into ${parts.length} parts.`);
                }
            } else {
                console.warn(`[filterCanvassingDataByMonth] 'Date' value is not a string for entry:`, entry);
            }
            return false;
        });
        console.log(`[filterCanvassingDataByMonth] Filtered ${filteredData.length} entries for ${targetMonth}`);
        return filteredData;
    }

    // Helper function to fetch CSV data from a URL
    async function fetchCSV(url) {
        console.log('Attempting to fetch CSV from:', url);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} from ${url}`);
            }
            const text = await response.text();
            console.log('CSV fetched successfully. Data length:', text.length);
            return text;
        } catch (error) {
            console.error('Error fetching CSV:', error);
            return null; // Return null on error
        }
    }

    // Helper function to parse CSV text into an array of objects
    function parseCSV(csvText) {
        if (!csvText) return [];
        console.log('Attempting to parse CSV text with explicit column mapping...');
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== ''); // Split by newline, remove empty lines
        if (lines.length === 0) {
            console.warn("CSV text is empty or contains no valid lines.");
            return [];
        }

        const data = [];
        // Assuming the master employee CSV has columns in this order:
        // Employee Code,Employee Name,Branch Name,Designation,Division
        for (let i = 1; i < lines.length; i++) { // Start from the second line (index 1) for data
            const currentLine = lines[i];
            const values = [];
            let inQuote = false;
            let currentField = '';
            for (let char of currentLine) {
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentField.trim());
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            values.push(currentField.trim()); // Add the last field

            // Ensure the row has enough columns
            if (values.length < 5) {
                console.warn(`Skipping malformed master employee row ${i + 1}: Not enough columns. Line: "${currentLine}"`);
                continue;
            }

            const row = {
                'Employee Code': values[0],
                'Employee Name': values[1],
                'Branch Name': values[2],
                'Designation': values[3],
                'Division': values[4]
            };
            data.push(row);
        }
        return data;
    }

    // Helper to display messages for a specific message element
    function displayReportMessage(messageElement, message, type = 'info') {
        if (messageElement) {
            messageElement.innerHTML = `<div class="message ${type}">${message}</div>`;
            messageElement.style.display = 'block';
            setTimeout(() => {
                messageElement.innerHTML = '';
                messageElement.style.display = 'none';
            }, 5000); // Hide after 5 seconds
        } else {
            console.error("Error: Message element not found.");
        }
    }

    // Function to populate a table
    function populateTable(tableBodyElement, employeesList) {
        tableBodyElement.innerHTML = ''; // Clear existing table data
        if (employeesList.length === 0) {
            return false; // Indicates no data to display
        }

        employeesList.forEach((employee, index) => {
            const row = tableBodyElement.insertRow();
            row.insertCell(0).textContent = index + 1; // SL.No.
            row.insertCell(1).textContent = employee['Employee Code'];
            row.insertCell(2).textContent = employee['Employee Name'];
            row.insertCell(3).textContent = employee['Division'];
            row.insertCell(4).textContent = employee['Designation'];
        });
        return true; // Indicates data was displayed
    }

    // Function to handle CSV download
    function handleDownload(employeesList, filename) {
        if (employeesList.length === 0) {
            alert(`No ${filename.replace('.csv', '').replace(/_/g, ' ')} to download.`);
            return;
        }

        const csvHeaders = ["SL.No.", "Employee Code", "Employee Name", "Division", "Designation"];
        const csvRows = employeesList.map((employee, index) => [
            index + 1,
            employee['Employee Code'],
            employee['Employee Name'],
            employee['Division'],
            employee['Designation']
        ].map(value => {
            const stringValue = String(value || '').replace(/"/g, '""');
            return `"${stringValue}"`;
        }).join(','));

        const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert("Your browser does not support automatic file downloads. Please copy the data from the table above.");
        }
    }

    // Main function to generate and display the Non-Participants Reports
    async function generateAndDisplayNonParticipantsReport() {
        mainNonParticipantsMessage.style.display = 'none'; // Hide main messages
        
        nonParticipantsInVisitDisplay.style.display = 'none';
        nonParticipantsInCallDisplay.style.display = 'none';
        nonParticipantsInVisitTableBody.innerHTML = '';
        nonParticipantsInCallTableBody.innerHTML = '';

        displayReportMessage(mainNonParticipantsMessage, "Generating Non-Participants Reports for the current month...", 'info');

        try {
            // 1. Fetch Master Employee Data
            const masterCSVText = await fetchCSV(masterEmployeesCSVUrl);
            if (!masterCSVText) {
                displayReportMessage(mainNonParticipantsMessage, "Failed to load Master Employee data. Cannot generate report.", 'error');
                return;
            }
            masterEmployeesData = parseCSV(masterCSVText);
            console.log('Master Employees Data (Parsed):', masterEmployeesData.length, 'entries');

            if (masterEmployeesData.length === 0) {
                displayReportMessage(mainNonParticipantsMessage, "No master employee data found.", 'info');
                return;
            }

            // 2. Get Canvassing Data for the Current Month
            if (!window.allCanvassingData) {
                displayReportMessage(mainNonParticipantsMessage, "Canvassing data not yet loaded. Please ensure the main dashboard script has run.", 'error');
                console.error("window.allCanvassingData is not available.");
                return;
            }
            console.log('Total raw canvassing data entries (window.allCanvassingData):', window.allCanvassingData.length);


            const currentMonth = getCurrentMonthYear();
            console.log(`Determined current month: ${currentMonth}`);
            const currentMonthCanvassingData = filterCanvassingDataByMonth(window.allCanvassingData, currentMonth);
            console.log('Canvassing Data for Current Month (Filtered):', currentMonthCanvassingData.length, 'entries');

            if (currentMonthCanvassingData.length === 0) {
                displayReportMessage(mainNonParticipantsMessage, `No canvassing data found for the current month (${currentMonth}). All employees are considered non-participants for this month.`, 'info');
                // If no data for the current month, then all master employees are non-participants for both categories
                nonParticipatingInVisitEmployees = [...masterEmployeesData];
                nonParticipatingInCallEmployees = [...masterEmployeesData];
            } else {
                // Extract unique employee codes for 'Visit' activities in the current month
                const participatingInVisitCodes = new Set(
                    currentMonthCanvassingData
                        .filter(entry => {
                            // Assuming 'Activity Type' is the correct header for activity type
                            const isVisit = entry['Activity Type'] && entry['Activity Type'].toLowerCase() === 'visit';
                            return isVisit;
                        })
                        .map(entry => entry['Employee Code'])
                );
                console.log('Participating in Visit Codes (Current Month) - Count:', participatingInVisitCodes.size, 'Codes:', [...participatingInVisitCodes]);

                // Extract unique employee codes for 'Calls' activities in the current month
                const participatingInCallCodes = new Set(
                    currentMonthCanvassingData
                        .filter(entry => {
                            // Assuming 'Activity Type' is the correct header for activity type
                            const isCalls = entry['Activity Type'] && entry['Activity Type'].toLowerCase() === 'calls';
                            return isCalls;
                        })
                        .map(entry => entry['Employee Code'])
                );
                console.log('Participating in Call Codes (Current Month) - Count:', participatingInCallCodes.size, 'Codes:', [...participatingInCallCodes]);

                // 3. Filter Master Employees for Non-Participants in Visits for the current month
                nonParticipatingInVisitEmployees = masterEmployeesData.filter(employee => {
                    const isNonParticipant = !participatingInVisitCodes.has(employee['Employee Code']);
                    return isNonParticipant;
                });
                console.log('Non-Participating in Visits Employees (Current Month) - Count:', nonParticipatingInVisitEmployees.length, 'Entries:', nonParticipatingInVisitEmployees);

                // 4. Filter Master Employees for Non-Participants in Calls for the current month
                nonParticipatingInCallEmployees = masterEmployeesData.filter(employee => {
                    const isNonParticipant = !participatingInCallCodes.has(employee['Employee Code']);
                    return isNonParticipant;
                });
                console.log('Non-Participating in Calls Employees (Current Month) - Count:', nonParticipatingInCallEmployees.length, 'Entries:', nonParticipatingInCallEmployees);
            }

            // 5. Populate and display tables
            let allReportsEmpty = true;

            // Visits Report
            if (populateTable(nonParticipantsInVisitTableBody, nonParticipatingInVisitEmployees)) {
                nonParticipantsInVisitDisplay.style.display = 'block';
                displayReportMessage(nonParticipantsInVisitMessage, `Found ${nonParticipatingInVisitEmployees.length} non-participants in visits for ${currentMonth}.`, 'success');
                allReportsEmpty = false;
            } else {
                displayReportMessage(nonParticipantsInVisitMessage, `All employees have participated in visits for ${currentMonth}!`, 'info');
            }

            // Calls Report
            if (populateTable(nonParticipantsInCallTableBody, nonParticipatingInCallEmployees)) {
                nonParticipantsInCallDisplay.style.display = 'block';
                displayReportMessage(nonParticipantsInCallMessage, `Found ${nonParticipatingInCallEmployees.length} non-participants in calls for ${currentMonth}.`, 'success');
                allReportsEmpty = false;
            } else {
                displayReportMessage(nonParticipantsInCallMessage, `All employees have participated in calls for ${currentMonth}!`, 'info');
            }

            if (allReportsEmpty) {
                displayReportMessage(mainNonParticipantsMessage, `All employees have participated in both visits and calls for ${currentMonth}, or no data available for this month.`, 'info');
            } else {
                displayReportMessage(mainNonParticipantsMessage, `Non-Participants Reports generated successfully for ${currentMonth}.`, 'success');
            }

        } catch (error) {
            console.error('Error generating non-participants report:', error);
            displayReportMessage(mainNonParticipantsMessage, `Failed to generate reports: ${error.message}`, 'error');
        }
    }

    // Event listeners for download buttons
    if (downloadNonParticipantsInVisitBtn) {
        downloadNonParticipantsInVisitBtn.addEventListener('click', () => {
            handleDownload(nonParticipatingInVisitEmployees, 'non_participating_in_visits_current_month.csv');
        });
    }

    if (downloadNonParticipantsInCallBtn) {
        downloadNonParticipantsInCallBtn.addEventListener('click', () => {
            handleDownload(nonParticipatingInCallEmployees, 'non_participating_in_calls_current_month.csv');
        });
    }

    // Event listener for when the Non-Participant Report tab is clicked
    if (nonParticipantReportTabBtn) {
        nonParticipantReportTabBtn.addEventListener('click', () => {
            generateAndDisplayNonParticipantsReport();
        });
    }
});