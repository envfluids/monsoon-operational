document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const csvUrl = 'assets/data/blend_output_summary.csv'; // Path to your CSV file
    const initialCenter = [25, 79.9629]; // Approx center of India
    const initialZoom = 4;
    const indiaGeoJsonUrl = 'https://raw.githubusercontent.com/datameet/maps/master/Country/india-osm.geojson'; // Use the RAW file URL

    // Define colors similar to Python's plasma map (approximations)
    const PERIOD_COLORS = {
        "just_week1": '#F05929',
        "weeks12": '#FD952B',
        "weeks23": '#E7C750',
        "weeks34": '#BCE365',
        "weeks4later": '#81EC7D',
        "later": '#32ECA2',
        "none": '#D3D3D3'
    };
    const LEGEND_LABELS = {
        "just_week1": "Week 1 Only (>=50%)",
        "weeks12": "Weeks 1-2 Sum (>=50%)",
        "weeks23": "Weeks 2-3 Sum (>=50%)",
        "weeks34": "Weeks 3-4 Sum (>=50%)",
        "weeks4later": "Weeks 4-Later Sum (>=50%)",
        "later": "Later Only (Wk 5+) (>=50%)",
        "none": "Below Threshold (<50%)"
    };
    let map;
    let forecastChart;
    let allGridData = [];
    let gridLayer; // Make gridLayer accessible in broader scope if needed, though not strictly necessary here
    
    // --- Initialize Leaflet Map ---
    function initMap() {
        map = L.map('map', {
            // Optional: Set a background color
            // style: 'background-color: #f0f0f0;'
        }).setView(initialCenter, initialZoom);

        // ** MODIFICATION START: Create a pane for the GeoJSON outline **
        map.createPane('geoJsonPane');
        // Set its z-index lower than the overlay pane (default 400)
        map.getPane('geoJsonPane').style.zIndex = 350;
        // Ensure pointer events are disabled on the outline itself if it should only be visual
        map.getPane('geoJsonPane').style.pointerEvents = 'none';
        // ** MODIFICATION END **


        // Fetch and add the India GeoJSON outline
        fetch(indiaGeoJsonUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(geojsonData => {
                L.geoJSON(geojsonData, {
                    // ** MODIFICATION START: Assign to the custom pane **
                    pane: 'geoJsonPane',
                    // ** MODIFICATION END **
                    style: function (feature) {
                        return {
                            color: "#000000",
                            // Use a lighter color for the outline
                            fillColor: "#FFFFFF",
                            weight: 1,
                            opacity: 0.8,
                            fillOpacity: 1,
                            // ** IMPORTANT: Make the outline non-interactive **
                            // interactive: false // Alternative way to disable interaction on the layer itself
                        };
                    },
                     // Ensure the GeoJSON layer itself doesn't capture clicks
                    interactive: false
                }).addTo(map);
                console.log("India GeoJSON layer added successfully to geoJsonPane.");
            })
            .catch(error => {
                console.error('Error fetching or adding GeoJSON layer:', error);
                alert('Could not load the India map outline. Please check the console or the GeoJSON URL.');
            });
    }

    // --- Initialize Chart.js ---
    // (Keep the initChart function as it was)
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
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Click a map cell to view forecast'
                    },
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, max: 1.0, title: { display: true, text: 'Probability' } },
                    x: { title: { display: true, text: 'Forecast Period' } }
                }
            }
        });
    }


    // --- Load and Process CSV Data ---
    // (Keep the loadData function as it was)
    function loadData() {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: function (results) {
                console.log("CSV Parsing Complete:", results);
                if (results.errors.length > 0) {
                    console.error("CSV Parsing Errors:", results.errors);
                    alert("Error parsing CSV data. Check console for details.");
                }
                allGridData = results.data.filter(row =>
                    isValidNumber(row.lat) && isValidNumber(row.lon) && row.time &&
                    isValidNumber(row.week1) && isValidNumber(row.week2) &&
                    isValidNumber(row.week3) && isValidNumber(row.week4) && isValidNumber(row.later)
                );
                if (allGridData.length === 0) {
                    console.warn("No valid data rows found after parsing and filtering.");
                    alert("Warning: No valid forecast data found in the CSV.");
                } else {
                    console.log(`Loaded ${allGridData.length} valid data rows.`);
                    populateMap(allGridData); // This will add gridLayer to the map
                    populateTable(allGridData);
                }
            },
            error: function (error) {
                console.error("Error fetching or parsing CSV:", error);
                alert("Failed to load forecast data. Please check the CSV file path and format.");
            }
        });
    }

    // Helper function
    function isValidNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }



    // --- Populate Map with Grid Cells ---
    // (Keep the populateMap function mostly as it was)
     function populateMap(data) {
        // const bounds = []; // Bounds calculation might still be useful
        gridLayer = L.layerGroup(); // Initialize the layer group (if not already global)

        data.forEach(row => {
            const lat = row.lat;
            const lon = row.lon;
            const cellBounds = [[lat - 1.0, lon - 1.0], [lat + 1.0, lon + 1.0]];
            // bounds.push(cellBounds[0]);
            // bounds.push(cellBounds[1]);

            const maxPeriod = calculateMaxPeriod(row);
            const cellColor = PERIOD_COLORS[maxPeriod] || PERIOD_COLORS['none'];

            const rectangle = L.rectangle(cellBounds, {
                color: "#333",
                weight: 0.5,
                opacity: 0.6,
                fillColor: cellColor,
                fillOpacity: 0.7,
                 // Rectangles should be interactive by default, ensure they are
                interactive: true // Explicitly set, though true is default
            });

            rectangle.feature = { properties: row };

            rectangle.on('click', (e) => {
                 console.log("Rectangle clicked:", e.target.feature.properties); // Add log for debugging
                 // Optional: add highlight effect
                 // resetHighlight(); // Function to reset style of previously clicked
                 // e.target.setStyle({ weight: 2, color: 'red' }); // Highlight current
                 // Store reference to clicked?
                updateChart(e.target.feature.properties);
            });

            gridLayer.addLayer(rectangle);
        });

        gridLayer.addTo(map); // Add the layer group containing all rectangles
        // gridLayer will be added to the default 'overlayPane' (zIndex 400)
        // which is above 'geoJsonPane' (zIndex 350)

        // Optional: Fit bounds
        // if (bounds.length > 0) {
        //     map.fitBounds(bounds, { padding: [20, 20] });
        // } else {
        //     console.warn("No valid bounds calculated for map fitting.");
        // }
        console.log("Grid layer added to map.");
    }

    // --- Calculate Max Period ---
    // (Keep the calculateMaxPeriod function as it was)
    function calculateMaxPeriod(data) {
       if (!data) return "none";
       const vf = [data.week1 || 0, data.week2 || 0, data.week3 || 0, data.week4 || 0, data.later || 0];
       if (vf[0] >= 0.5) return 'just_week1';
       if (vf[4] >= 0.5) return 'later';
       const sums = [vf[0] + vf[1], vf[1] + vf[2], vf[2] + vf[3], vf[3] + vf[4]];
       const keys = ['weeks12', 'weeks23', 'weeks34', 'weeks4later'];
       let maxIdx = 0;
       let maxSum = sums[0];
       for (let i = 1; i < sums.length; i++) { if (sums[i] > maxSum) { maxSum = sums[i]; maxIdx = i; } }
       return (maxSum >= 0.5) ? keys[maxIdx] : 'none';
   }


    // --- Update the Bar Chart ---
    // (Keep the updateChart function as it was)
    function updateChart(data) {
        if (!data || !forecastChart) return;
        let labels = ["Invalid Date"];
        let chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon})`;
        try {
            const baseDate = new Date(data.time + 'T00:00:00');
            if (isNaN(baseDate.getTime())) throw new Error("Invalid date format");
            const options = { month: 'numeric', day: 'numeric' };
            const addDays = (date, days) => { const result = new Date(date); result.setDate(result.getDate() + days); return result; };
            const formatDate = (date) => date.toLocaleDateString(undefined, options);
            labels = [
                `Wk 1 (${formatDate(addDays(baseDate, 1))} - ${formatDate(addDays(baseDate, 7))})`,
                `Wk 2 (${formatDate(addDays(baseDate, 8))} - ${formatDate(addDays(baseDate, 14))})`,
                `Wk 3 (${formatDate(addDays(baseDate, 15))} - ${formatDate(addDays(baseDate, 21))})`,
                `Wk 4 (${formatDate(addDays(baseDate, 22))} - ${formatDate(addDays(baseDate, 28))})`,
                `Later (${formatDate(addDays(baseDate, 29))}+)`
            ];
            chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon}) - Issued: ${formatDate(baseDate)}`;
        } catch (e) { console.error("Error formatting dates:", e); chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon}) - Date Error`; }
        forecastChart.data.labels = labels;
        forecastChart.data.datasets[0].data = [data.week1, data.week2, data.week3, data.week4, data.later];
        forecastChart.options.plugins.title.text = chartTitle;
        forecastChart.update();
    }


    // --- Function to Populate the HTML Table ---
    // (Keep the populateTable function as it was)
     function populateTable(data) {
        const tbody = document.querySelector('#onset-table tbody');
        if (!tbody) { console.error('Table body #onset-table tbody not found.'); return; }
        tbody.innerHTML = '';
        const displayColumns = ['lat', 'lon', 'time', 'week1', 'week2', 'week3', 'week4', 'later'];
        const formatColumns = ['week1', 'week2', 'week3', 'week4', 'later'];
        data.forEach(row => {
            const tr = document.createElement('tr');
            displayColumns.forEach(col => {
                const td = document.createElement('td');
                let value = row[col];
                if (formatColumns.includes(col) && isValidNumber(value)) { value = value.toFixed(3); }
                else if (value === null || value === undefined) { value = '-'; }
                td.textContent = value;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function addLegendToMap() {
        const legend = L.control({ position: 'bottomleft' }); // Position the legend

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend'); // Create a div with classes
            let legendHtml = '<h4>Onset Probability Period</h4>'; // Legend title

            // Loop through our period colors and labels
            for (const periodKey in PERIOD_COLORS) {
                if (PERIOD_COLORS.hasOwnProperty(periodKey)) {
                    const color = PERIOD_COLORS[periodKey];
                    // Use the friendly label, fallback to the key if not found
                    const label = LEGEND_LABELS[periodKey] || periodKey;

                        // Add a line item to the legend HTML
                        // Uses an <i> tag for the color swatch, styled via CSS
                    legendHtml +=
                        '<div class="legend-item">' +
                        '<i style="background:' + color + '"></i> ' +
                        label +
                        '</div>';
                }
            }

            div.innerHTML = legendHtml;
            return div;
        };

        legend.addTo(map); // Add the legend control to the map
        legend.getContainer().addEventListener('mouseover', function () {
            map.dragging.disable();
            map.touchZoom.disable();
            map.doubleClickZoom.disable();
            map.scrollWheelZoom.disable();
            map.boxZoom.disable();
            map.keyboard.disable();
        });

        legend.getContainer().addEventListener('mouseout', function () {
                map.dragging.enable();
                map.touchZoom.enable();
                map.doubleClickZoom.enable();
                map.scrollWheelZoom.enable();
                map.boxZoom.enable();
                map.keyboard.enable();
        });
        
    }
    // --- Initialize ---
    initMap();
    initChart();
    loadData();
    addLegendToMap(); // Add the legend to the map

}); // End DOMContentLoaded