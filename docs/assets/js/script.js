document.addEventListener('DOMContentLoaded', () => {

  // --- Configuration ---
  const csvUrl = 'assets/data/blend_output_summary.csv'; // Path to your CSV file
  const initialCenter = [20.5937, 78.9629]; // Approx center of India
  const initialZoom = 5;

  // Define colors similar to Python's plasma map (approximations)
  const PERIOD_COLORS = {
      "just_week1": '#F05929', // Hex equivalent of new Color(240, 89, 41)
      "weeks12": '#FD952B',    // Hex equivalent of new Color(253, 149, 43)
      "weeks23": '#E7C750',    // Hex equivalent of new Color(231, 199, 80)
      "weeks34": '#BCE365',    // Hex equivalent of new Color(188, 227, 101)
      "weeks4later": '#81EC7D',// Hex equivalent of new Color(129, 236, 125)
      "later": '#32ECA2',      // Hex equivalent of new Color(50, 236, 162)
      "none": '#D3D3D3'        // Hex equivalent of Color.LIGHT_GRAY
  };

  let map;
  let forecastChart;
  let allGridData = []; // To store parsed CSV data

  // --- Initialize Leaflet Map ---
  function initMap() {
      map = L.map('map').setView(initialCenter, initialZoom);

      L.tileLayer('http://a.tile.opentopomap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
  }

  // --- Initialize Chart.js ---
  function initChart() {
      const ctx = document.getElementById('forecastChart').getContext('2d');
      forecastChart = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: [], // Initial empty labels
              datasets: [{
                  label: 'Forecast Probability',
                  data: [], // Initial empty data
                  backgroundColor: 'rgba(75, 192, 192, 0.6)', // Example color
                  borderColor: 'rgba(75, 192, 192, 1)',
                  borderWidth: 1
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false, // Allow chart to fill container height
              plugins: {
                  title: {
                      display: true,
                      text: 'Click a map cell to view forecast'
                  },
                  legend: {
                      display: false // Hide legend for single dataset
                  }
              },
              scales: {
                  y: {
                      beginAtZero: true,
                      max: 1.0, // Probability scale 0-1
                      title: {
                          display: true,
                          text: 'Probability'
                      }
                  },
                  x: {
                      title: {
                          display: true,
                          text: 'Forecast Period'
                      }
                  }
              }
          }
      });
  }

  // --- Load and Process CSV Data ---
  function loadData() {
      Papa.parse(csvUrl, {
          download: true,
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true, // Auto-convert numbers/booleans
          complete: function(results) {
              console.log("CSV Parsing Complete:", results);
              if (results.errors.length > 0) {
                  console.error("CSV Parsing Errors:", results.errors);
                  alert("Error parsing CSV data. Check console for details.");
                  // Display errors appropriately
              }
               // Filter out rows with invalid essential data upfront
              allGridData = results.data.filter(row =>
                  isValidNumber(row.lat) &&
                  isValidNumber(row.lon) &&
                  row.time && // Ensure time exists
                  isValidNumber(row.week1) &&
                  isValidNumber(row.week2) &&
                  isValidNumber(row.week3) &&
                  isValidNumber(row.week4) &&
                  isValidNumber(row.later)
              );

              if (allGridData.length === 0) {
                  console.warn("No valid data rows found after parsing and filtering.");
                  alert("Warning: No valid forecast data found in the CSV.");
                  // Handle empty data scenario
              } else {
                  console.log(`Loaded ${allGridData.length} valid data rows.`);
                  populateMap(allGridData);
                  populateTable(allGridData); // Populate the HTML table
              }
          },
          error: function(error) {
               console.error("Error fetching or parsing CSV:", error);
               alert("Failed to load forecast data. Please check the CSV file path and format.");
          }
      });
  }

   // Helper to check if a value is a valid, non-NaN number
  function isValidNumber(value) {
      return typeof value === 'number' && !isNaN(value);
  }


  // --- Populate Map with Grid Cells ---
  function populateMap(data) {
      const bounds = []; // To calculate overall map bounds
      const gridLayer = L.layerGroup(); // Use layer group for easier management

      data.forEach(row => {
          const lat = row.lat;
          const lon = row.lon;

          // Calculate cell bounds
          const cellBounds = [
              [lat - 1.0, lon - 1.0], // Southwest corner [lat, lon]
              [lat + 1.0, lon + 1.0]  // Northeast corner [lat, lon]
          ];
          bounds.push(cellBounds[0]);
          bounds.push(cellBounds[1]);

          // Determine cell color
          const maxPeriod = calculateMaxPeriod(row);
          const cellColor = PERIOD_COLORS[maxPeriod] || PERIOD_COLORS['none'];

          // Create rectangle
          const rectangle = L.rectangle(cellBounds, {
              color: "#333", // Border color
              weight: 0.5,      // Border weight
              opacity: 0.6,
              fillColor: cellColor,
              fillOpacity: 0.7
          });

          // Store data with the rectangle for easy access on click
          rectangle.feature = { properties: row };

          // Add click listener
          rectangle.on('click', (e) => {
               // Highlight clicked rectangle (optional)
               // Maybe reset style of previously clicked? complex state to manage.
               // e.target.setStyle({ weight: 2, color: 'red' });
              updateChart(e.target.feature.properties);
          });

          gridLayer.addLayer(rectangle); // Add to layer group
      });

      gridLayer.addTo(map); // Add all rectangles at once

      // Fit map to the bounds of all grid cells
      if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [20, 20] }); // Add some padding
      } else {
           console.warn("No valid bounds calculated for map fitting.");
      }
  }

  // --- Calculate Max Period (JavaScript version) ---
  function calculateMaxPeriod(data) {
       if (!data) return "none";

      // Ensure probabilities are numbers, default to 0 if not
       const vf = [
          data.week1 || 0,
          data.week2 || 0,
          data.week3 || 0,
          data.week4 || 0,
          data.later || 0
      ];


      if (vf[0] >= 0.5) return 'just_week1';
      if (vf[4] >= 0.5) return 'later';

      const sums = [
          vf[0] + vf[1], // weeks12
          vf[1] + vf[2], // weeks23
          vf[2] + vf[3], // weeks34
          vf[3] + vf[4]  // weeks4later
      ];
      const keys = ['weeks12', 'weeks23', 'weeks34', 'weeks4later'];

      let maxIdx = 0;
      let maxSum = sums[0];
      for (let i = 1; i < sums.length; i++) {
          if (sums[i] > maxSum) {
              maxSum = sums[i];
              maxIdx = i;
          }
      }

      return (maxSum >= 0.5) ? keys[maxIdx] : 'none';
  }

  // --- Update the Bar Chart ---
  function updateChart(data) {
      if (!data || !forecastChart) return;

      // Format date labels (assuming 'time' is YYYY-MM-DD string from CSV)
       let labels = ["Invalid Date"];
       let chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon})`;
      try {
          const baseDate = new Date(data.time + 'T00:00:00'); // Treat as local date
           if (isNaN(baseDate.getTime())) {
               throw new Error("Invalid date format in CSV time field");
           }
          const options = { month: 'numeric', day: 'numeric' }; // MM/DD format

          const addDays = (date, days) => {
               const result = new Date(date);
               result.setDate(result.getDate() + days);
               return result;
          };

          const formatDate = (date) => date.toLocaleDateString(undefined, options);

           labels = [
              `Wk 1 (${formatDate(addDays(baseDate, 1))} - ${formatDate(addDays(baseDate, 7))})`,
              `Wk 2 (${formatDate(addDays(baseDate, 8))} - ${formatDate(addDays(baseDate, 14))})`,
              `Wk 3 (${formatDate(addDays(baseDate, 15))} - ${formatDate(addDays(baseDate, 21))})`,
              `Wk 4 (${formatDate(addDays(baseDate, 22))} - ${formatDate(addDays(baseDate, 28))})`,
              `Later (${formatDate(addDays(baseDate, 29))}+)`
          ];
            chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon}) - Issued: ${formatDate(baseDate)}`;

      } catch (e) {
           console.error("Error formatting dates:", e);
           chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon}) - Date Error`;
      }


      // Update chart data
      forecastChart.data.labels = labels;
      forecastChart.data.datasets[0].data = [
          data.week1,
          data.week2,
          data.week3,
          data.week4,
          data.later
      ];
      forecastChart.options.plugins.title.text = chartTitle;
      forecastChart.update(); // Redraw the chart
  }

  // --- Function to Populate the HTML Table ---
  function populateTable(data) {
      const tbody = document.querySelector('#onset-table tbody');
      if (!tbody) {
          console.error('Table body #onset-table tbody not found.');
          return;
      }
      tbody.innerHTML = ''; // Clear existing rows

      // Define which columns need number formatting and desired order
      const displayColumns = ['lat', 'lon', 'time', 'week1', 'week2', 'week3', 'week4', 'later'];
      const formatColumns = ['week1', 'week2', 'week3', 'week4', 'later'];

      data.forEach(row => {
          const tr = document.createElement('tr');
          displayColumns.forEach(col => {
              const td = document.createElement('td');
              let value = row[col];

              // Format numeric columns to fixed decimal places (e.g., 4)
              if (formatColumns.includes(col) && isValidNumber(value)) {
                  value = value.toFixed(4); // Adjust decimal places as needed
              } else if (value === null || value === undefined) {
                  value = '-'; // Display placeholder for missing values
              }

              td.textContent = value;
              tr.appendChild(td);
          });
          tbody.appendChild(tr);
      });
  }


  // --- Initialize ---
  initMap();
  initChart();
  loadData(); // Load data after map and chart are ready

}); // End DOMContentLoaded