document.addEventListener('DOMContentLoaded', function() {
    const customerDetailsModal = document.getElementById('customerDetailsModal');
    const julyDashboardModal = document.getElementById('julyDashboardModal'); // Add this line
    const tabButtons = document.querySelectorAll('.tab-button'); // Get all tab buttons

    // Function to hide all report sections and the modal
    function hideAllContent() {
        document.querySelectorAll('.report-section').forEach(section => {
            section.style.display = 'none'; // Hide all regular report sections
        });
        customerDetailsModal.style.display = 'none'; // Hide the customer details modal
        julyDashboardModal.style.display = 'none'; // Add this line
    }

    // Loop through all tab buttons and add click listeners
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            hideAllContent(); // Always hide everything first to ensure a clean slate

            // Update active tab button classes (remove 'active' from all, add to clicked)
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Logic to show the correct content based on the clicked button
            if (this.id === 'detailedCustomerViewTabBtn') {
                // If "Detailed Customer View" is clicked, show the modal
                customerDetailsModal.style.display = 'block';

                // IMPORTANT: If you have a function that loads initial customer data
                // when the tab is clicked, you should call it here. E.g.:
                // loadCustomerDataForModal();
            } else if (this.id === 'julyDashboardTabBtn') { // Add this new condition
                julyDashboardModal.style.display = 'block';
                // Call the function to load and display July dashboard data
                if (window.loadJulyDashboardData) { // Ensure the function exists
                    window.loadJulyDashboardData();
                }
            }
            else {
                // For all other regular report tabs
                let targetSectionId;
                if (this.id === 'nonParticipantReportTabBtn') {
                    // Special case for this button if its ID doesn't follow the general 'TabBtn' -> 'Section' convention
                    targetSectionId = 'nonParticipantReportSection';
                } else {
                    // General convention: tab button ID ends with 'TabBtn', section ID ends with 'Section'
                    targetSectionId = this.id.replace('TabBtn', 'Section');
                }

                const targetSection = document.getElementById(targetSectionId);
                if (targetSection) {
                    targetSection.style.display = 'block'; // Show the relevant section
                }
            }
        });
    });

    // Add event listener for the customerDetailsModal's close button (the 'x')
    const closeButton = document.querySelector('#customerDetailsModal .close-button');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            customerDetailsModal.style.display = 'none'; // Hide the modal
            // Optional: If you want a tab to be selected when the modal closes,
            // e.g., reactivate the default tab like "All Branch Snapshot".
            // document.getElementById('allBranchSnapshotTabBtn').click();
        });
    }

    // Add event listener for the July Dashboard modal's close button
    const closeJulyDashboardButton = document.querySelector('#julyDashboardModal .close-button');
    if (closeJulyDashboardButton) {
        closeJulyDashboardButton.addEventListener('click', function() {
            julyDashboardModal.style.display = 'none'; // Hide the July Dashboard modal
        });
    }

    // Add event listener to close modal if user clicks outside of modal content
    window.addEventListener('click', function(event) {
        if (event.target === customerDetailsModal) { // Use '===' for strict comparison
            customerDetailsModal.style.display = 'none'; // Hide the modal
            // Optional: Reactivate default tab here as well if you did above.
        } else if (event.target === julyDashboardModal) { // Add this for July Dashboard modal
            julyDashboardModal.style.display = 'none'; // Hide the July Dashboard modal
        }
    });

    // Optional: Set an initial active tab/section on page load
    // This assumes 'allBranchSnapshotTabBtn' is your default starting tab.
    // If your script.js already does an initial tab display, remove this line.
    document.getElementById('allBranchSnapshotTabBtn').click();
});