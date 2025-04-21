// helper: render rows into a given <tbody>
function renderTableRows(tbody, rows, columns) {
    rows.forEach(row => {
      const tr = document.createElement('tr');
      columns.forEach(col => {
        const td = document.createElement('td');
        td.textContent = row[col];
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  
  document.addEventListener('DOMContentLoaded', () => {
  
    // 2) Load and display onset.csv
    fetch('assets/data/onset.csv')
      .then(res => res.text())
      .then(csv => Papa.parse(csv, { header: true }))
      .then(results => {
        const tbody = document.querySelector('#onset-table tbody');
        renderTableRows(tbody, results.data, ['lat','lon','onset_date','probability']);
      })
      .catch(console.error);
  });
  