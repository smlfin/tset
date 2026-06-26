document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANT: Replace this with the actual published CSV URL of your "Dashboard July" sheet
    const JULY_DASHBOARD_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1iXVjyZ1tFEnFjiuUONDwLtAAeXIT75dQMmHqnCBGc9DG32BzJ5urJwHHA6GEmCGQqu4YcB92eGM0/pub?gid=1038174198&single=true&output=csv';

    const julyDashboardDisplay = document.getElementById('julyDashboardDisplay');
    const julyDashboardMessage = document.getElementById('julyDashboardMessage');

    function displayJulyDashboardMessage(message, type) {
        if (julyDashboardMessage) {
            julyDashboardMessage.textContent = message;
            julyDashboardMessage.className = `message ${type}`;
            julyDashboardMessage.style.display = 'block';
            setTimeout(() => {
                julyDashboardMessage.style.display = 'none';
            }, 5000);
        }
    }

    async function loadJulyDashboardData() {
        displayJulyDashboardMessage('Loading July dashboard data...', 'info');
        try {
            const response = await fetch(JULY_DASHBOARD_CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();

            const parsedData = parseJulyDashboardCSV(csvText);

            // ******************************************************
            // ADD THIS LINE FOR DEBUGGING:
            window.parsedJulyDashboardData = parsedData; // Expose parsedData globally for console inspection
            // ******************************************************

            if (Object.keys(parsedData).length > 0) {
                renderJulyDashboard(parsedData);
                displayJulyDashboardMessage('July Dashboard loaded successfully.', 'success');
            } else {
                displayJulyDashboardMessage('No data found for July Dashboard or parsing failed. Ensure the Google Sheet is published correctly and contains data.', 'info');
            }

        } catch (error) {
            console.error('Error loading July dashboard data:', error);
            displayJulyDashboardMessage(`Failed to load July Dashboard: ${error.message}`, 'error');
        }
    }

    /**
     * Parses the CSV content to extract specific tabular and summary sections.
     * Handles duplicate header names by assigning unique names based on context.
     * @param {string} csv The raw CSV content as a string.
     * @returns {object} An object containing extracted data for each relevant dashboard section.
     */
    function parseJulyDashboardCSV(csv) {
        const lines = csv.split('\n').map(line => line.trim());
        const data = {};

        let currentSectionKey = null;
        let sectionHeaders = [];
        let readingTable = false;
        let summaryRowCounter = 0;

        // Map titles in CSV to desired keys in the data object
        const sectionTitles = {
            'Gross & Completed Targets by Division (July Data):': 'grossCompletedTargetsByDivision',
            'Employees Completing Individual Targets by Division (July Data):': 'employeesCompletingIndividualTargets',
            'Participating Employees Count by Division Category (July Data):': 'participatingEmployeesCount',
            'Non-Participating Employees Count by Division Category (July Data):': 'nonParticipatingEmployeesCount',
            'Breakdown by Activity Type (July Data):': 'breakdownByActivityType',
            'Activity Count by Division Category (July Data):': 'activityCountByDivisionCategory'
        };

        lines.forEach(line => {
            if (line === '') {
                readingTable = false;
                return;
            }

            const isNewSection = Object.keys(sectionTitles).some(title => line.startsWith(title));

            if (isNewSection) {
                for (const title in sectionTitles) {
                    if (line.startsWith(title)) {
                        currentSectionKey = sectionTitles[title];
                        data[currentSectionKey] = []; // Initialize as array for table rows or summary
                        sectionHeaders = []; // Reset headers for new section
                        readingTable = true;
                        summaryRowCounter = 0; // Reset summary row counter
                        break;
                    }
                }
            } else if (readingTable && currentSectionKey) {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));

                if (sectionHeaders.length === 0) { // First line after section title is headers
                    // Normalize headers: replace spaces and hyphens with underscores for internal keys
                    sectionHeaders = values.map(header =>
                        header.replace(/ /g, '_').replace(/-/g, '_')
                    );
                    // Handle duplicate header names by making them unique for object keys
                    const headerCounts = {};
                    sectionHeaders = sectionHeaders.map(header => {
                        headerCounts[header] = (headerCounts[header] || 0) + 1;
                        if (headerCounts[header] > 1) {
                            return `${header}_${headerCounts[header]}`;
                        }
                        return header;
                    });
                } else {
                    // Subsequent lines are data rows
                    const rowData = {};
                    sectionHeaders.forEach((header, index) => {
                        // Use the normalized header names as keys
                        rowData[header] = values[index] !== undefined ? values[index] : '';
                    });

                    // Special handling for summary sections (e.g., first two rows after header)
                    if (currentSectionKey === 'grossCompletedTargetsByDivision' && summaryRowCounter < 2) {
                        // These are the summary rows, treat them as objects in an array
                        data[currentSectionKey].push(rowData);
                        summaryRowCounter++;
                    } else if (currentSectionKey === 'grossCompletedTargetsByDivision' && summaryRowCounter >= 2) {
                        // After summary rows, remaining data for this section is a table.
                        // We might want to store this differently, or assume it's just the summary.
                        // For now, let's keep pushing to the same array.
                        data[currentSectionKey].push(rowData);
                    } else {
                        data[currentSectionKey].push(rowData);
                    }
                }
            }
        });
        return data;
    }

    /**
     * Renders the parsed July Dashboard data into the HTML display area.
     * @param {object} data The object containing all parsed sections of the dashboard data.
     */
    function renderJulyDashboard(data) {
        if (!julyDashboardDisplay) {
            console.error("July Dashboard display element not found.");
            return;
        }
        julyDashboardDisplay.innerHTML = ''; // Clear existing content

        // Helper to generate a table from an array of objects
        const createTableHtml = (tableData, title) => {
            if (!tableData || tableData.length === 0) {
                return `<div class="dashboard-section"><h3>${title}</h3><p>No data available.</p></div>`;
            }

            const headers = Object.keys(tableData[0]);
            let html = `<div class="dashboard-section"><h3>${title}</h3><div class="data-table-container"><table class="data-table"><thead><tr>`;
            headers.forEach(header => {
                html += `<th>${header.replace(/_/g, ' ')}</th>`; // Replace underscores for display
            });
            html += `</tr></thead><tbody>`;

            tableData.forEach(row => {
                html += `<tr>`;
                headers.forEach(header => {
                    html += `<td>${row[header]}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table></div></div>`;
            return html;
        };

        // Render each section dynamically
        if (data.grossCompletedTargetsByDivision) {
            let summaryHtml = `
                <div class="dashboard-section">
                    <h3>Gross & Completed Targets by Division</h3>
                    <div class="summary-cards-container">
            `;
            // Use normalized keys (with underscores) and replace for display
            data.grossCompletedTargetsByDivision.forEach(row => {
                // Ensure row properties exist before trying to replace, use 'N/A' if undefined
                const divisionCategory = row['Division_Category'] ? row['Division_Category'].replace(/_/g, ' ') : 'N/A';
                const grossTarget = row['Gross_Target'] ? row['Gross_Target'].replace(/_/g, ' ') : 'N/A';
                const completedTarget = row['Completed_Target'] ? row['Completed_Target'].replace(/_/g, ' ') : 'N/A';

                summaryHtml += `
                    <div class="summary-card">
                        <h4>${divisionCategory}</h4>
                        <p>Gross Target: <strong>${grossTarget}</strong></p>
                        <p>Completed Target: <strong>${completedTarget}</strong></p>
                    </div>
                `;
            });
            summaryHtml += `</div></div>`;
            julyDashboardDisplay.innerHTML += summaryHtml;
        }

        if (data.employeesCompletingIndividualTargets) {
            julyDashboardDisplay.innerHTML += createTableHtml(data.employeesCompletingIndividualTargets, 'Employees Completing Individual Targets by Division');
        }
        if (data.participatingEmployeesCount) {
            julyDashboardDisplay.innerHTML += createTableHtml(data.participatingEmployeesCount, 'Participating Employees Count by Division Category');
        }
        if (data.nonParticipatingEmployeesCount) {
            julyDashboardDisplay.innerHTML += createTableHtml(data.nonParticipatingEmployeesCount, 'Non-Participating Employees Count by Division Category');
        }
        if (data.breakdownByActivityType) {
            julyDashboardDisplay.innerHTML += createTableHtml(data.breakdownByActivityType, 'Breakdown by Activity Type');
        }
        if (data.activityCountByDivisionCategory) {
            julyDashboardDisplay.innerHTML += createTableHtml(data.activityCountByDivisionCategory, 'Activity Count by Division Category');
        }
    }

    // Expose the main load function for tabLoader.js
    window.loadJulyDashboardData = loadJulyDashboardData;
});