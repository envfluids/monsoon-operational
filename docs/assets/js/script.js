/**
 * Renders table rows into a given <tbody> element.
 * @param {HTMLTableSectionElement} tbody - The <tbody> element to append rows to.
 * @param {Array<Object>} rows - An array of data objects.
 * @param {Array<string>} columns - An array of column keys in the desired display order.
 */
function renderTableRows(tbody, rows, columns) {
  // Define which columns need number formatting
  const formatColumns = ['week1', 'week2', 'week3', 'week4', 'later'];

  rows.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      let value = row[col]; // Get the value for the current column

      // Check if the current column needs formatting and the value is a valid number
      if (formatColumns.includes(col)) {
        const num = parseFloat(value); // Convert value to a floating-point number
        // If conversion is successful (not NaN), format to 2 decimal places
        // Otherwise, keep the original value (handles non-numeric or empty strings)
        if (!isNaN(num)) {
          value = num.toFixed(2);
        }
      }

      td.textContent = value; // Set the cell's text content
      tr.appendChild(td); // Add the cell to the row
    });
    tbody.appendChild(tr); // Add the row to the table body
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Load and display onset.csv
  fetch('assets/data/blend_output_summary.csv')
    .then(res => res.text()) // Get the response as text
    .then(csv => Papa.parse(csv, { header: true, skipEmptyLines: true })) // Parse the CSV text
    .then(results => {
      // Get the table body element
      const tbody = document.querySelector('#onset-table tbody');
      if (tbody) { // Ensure the tbody element exists
        tbody.innerHTML = ''; // Clear existing rows first

        // Define the columns in the desired order ('later' is now last)
        const displayColumns = ['lat', 'lon', 'time', 'week1', 'week2', 'week3', 'week4', 'later'];

        // Render the table rows with the specified columns and formatting
        renderTableRows(tbody, results.data, displayColumns);
      } else {
        console.error('Table body #onset-table tbody not found.');
      }
    })
    .catch(error => {
      // Log any errors during fetch or parsing
      console.error('Error loading or processing CSV:', error);
    });
});
