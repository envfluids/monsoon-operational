document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration (mostly shared) ---
    const csvUrl = 'assets/data/blend_output_summary.csv';
    const initialCenter = [23, 79.9629]; // Approx center of India
    const initialCenterAdv = [23, 72]; // Approx center of India
    const initialZoom = 4.3;
    const indiaGeoPath = 'assets/geography/india-osm.geojson';
    const indiaStateGeoPath = 'assets/geography/india.geojson';
    const latestDateFilePath = 'assets/data/latest.txt';

    // Variables for advanced map
    let map;
    let forecastChart;
    let allGridData = []; // This might be populated by either map's data loading
    let gridLayer;

    // Variables for home map
    let homeMap;
    let homeGridLayer;

    // Define colors and labels for the Advanced Map (not used by home map)
    const PERIOD_COLORS = {
        "just_week1": '#F05929', "weeks12": '#FD952B', "weeks23": '#E7C750',
        "weeks34": '#BCE365', "weeks4later": '#81EC7D', "later": '#32ECA2', "none": '#D3D3D3'
    };
    const LEGEND_LABELS = {
        "just_week1": "Week 1 Only (>=50%)", "weeks12": "Weeks 1-2 Sum (>=50%)",
        "weeks23": "Weeks 2-3 Sum (>=50%)", "weeks34": "Weeks 3-4 Sum (>=50%)",
        "weeks4later": "Weeks 4-Later Sum (>=50%)", "later": "Later Only (Wk 5+) (>=50%)",
        "none": "Below Threshold (<50%)"
    };

    function isValidNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }

    // --- Functions for Advanced Page (advanced.html) ---
    function initMapAdvanced() {
        map = L.map('map', {}).setView(initialCenterAdv, initialZoom);

        map.createPane('geoJsonPaneAdvanced'); // Use a specific pane name
        map.getPane('geoJsonPaneAdvanced').style.zIndex = 350;
        map.getPane('geoJsonPaneAdvanced').style.pointerEvents = 'none';

        fetch(indiaGeoPath)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok: ' + response.statusText);
                return response.json();
            })
            .then(geojsonData => {
                L.geoJSON(geojsonData, {
                    pane: 'geoJsonPaneAdvanced',
                    style: { color: "#000000", fillColor: "#FFFFFF", weight: 1, opacity: 0.8, fillOpacity: 1 },
                    interactive: false
                }).addTo(map);
                console.log("India GeoJSON layer added to advanced map.");
            })
            .catch(error => console.error('Error fetching/adding GeoJSON for advanced map:', error));
    }

    function initChartAdvanced() {
        const ctx = document.getElementById('forecastChart').getContext('2d');
        forecastChart = new Chart(ctx, { /* ... existing chart config ... */
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Forecast Probability', data: [], backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Click a map cell to view forecast' }, legend: { display: false } }, scales: { y: { beginAtZero: true, max: 1.0, title: { display: true, text: 'Probability' } }, x: { title: { display: true, text: 'Forecast Period' } } } }
        });
    }

    function resetHighlightAdvanced() {
        if (gridLayer) {
            gridLayer.eachLayer(function (layer) {
                if (layer instanceof L.Rectangle) {
                    layer.setStyle({ weight: 0.5, color: "#333", fillOpacity: 0.7 });
                }
            });
        }
    }

    function populateMapAdvanced(data) {
        gridLayer = L.layerGroup();
        data.forEach(row => {
            const lat = row.lat; const lon = row.lon;
            const cellBounds = [[lat - 1.0, lon - 1.0], [lat + 1.0, lon + 1.0]];
            const maxPeriod = calculateMaxPeriodAdvanced(row);
            const cellColor = PERIOD_COLORS[maxPeriod] || PERIOD_COLORS['none'];
            const rectangle = L.rectangle(cellBounds, { color: "#333", weight: 0.5, opacity: 0.6, fillColor: cellColor, fillOpacity: 0.7, interactive: true });
            rectangle.feature = { properties: row };
            rectangle.on('click', (e) => {
                resetHighlightAdvanced();
                e.target.setStyle({ weight: 2, color: "rgb(0, 0, 0)" });
                updateChartAdvanced(e.target.feature.properties);
            });
            gridLayer.addLayer(rectangle);
        });
        gridLayer.addTo(map);
        console.log("Advanced grid layer added to map.");
    }

    function calculateMaxPeriodAdvanced(data) {
       if (!data) return "none";
       const vf = [data.week1 || 0, data.week2 || 0, data.week3 || 0, data.week4 || 0, data.later || 0];
       if (vf[0] >= 0.5) return 'just_week1';
       if (vf[4] >= 0.5) return 'later';
       const sums = [vf[0] + vf[1], vf[1] + vf[2], vf[2] + vf[3], vf[3] + vf[4]];
       const keys = ['weeks12', 'weeks23', 'weeks34', 'weeks4later'];
       let maxIdx = 0; let maxSum = sums[0];
       for (let i = 1; i < sums.length; i++) { if (sums[i] > maxSum) { maxSum = sums[i]; maxIdx = i; } }
       return (maxSum >= 0.5) ? keys[maxIdx] : 'none';
   }

    function updateChartAdvanced(data) {
        if (!data || !forecastChart) return;
        let labels = ["Invalid Date"]; let chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon})`;
        try {
            const baseDate = new Date(data.time + 'T00:00:00'); if (isNaN(baseDate.getTime())) throw new Error("Invalid date format");
            const options = { month: 'numeric', day: 'numeric' }; const addDays = (date, days) => { const result = new Date(date); result.setDate(result.getDate() + days); return result; }; const formatDate = (date) => date.toLocaleDateString(undefined, options);
            labels = [`Wk 1 (${formatDate(addDays(baseDate, 1))} - ${formatDate(addDays(baseDate, 7))})`, `Wk 2 (${formatDate(addDays(baseDate, 8))} - ${formatDate(addDays(baseDate, 14))})`, `Wk 3 (${formatDate(addDays(baseDate, 15))} - ${formatDate(addDays(baseDate, 21))})`, `Wk 4 (${formatDate(addDays(baseDate, 22))} - ${formatDate(addDays(baseDate, 28))})`, `Later (${formatDate(addDays(baseDate, 29))}+)`];
            chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon}) - Issued: ${formatDate(baseDate)}`;
        } catch (e) { console.error("Error formatting dates:", e); chartTitle = `Forecast Probabilities (Lat: ${data.lat}, Lon: ${data.lon}) - Date Error`; }
        forecastChart.data.labels = labels; forecastChart.data.datasets[0].data = [data.week1, data.week2, data.week3, data.week4, data.later]; forecastChart.options.plugins.title.text = chartTitle; forecastChart.update();
    }

    function populateTableAdvanced(data) {
        const tbody = document.querySelector('#onset-table tbody'); if (!tbody) return;
        tbody.innerHTML = ''; const displayColumns = ['lat', 'lon', 'time', 'week1', 'week2', 'week3', 'week4', 'later']; const formatColumns = ['week1', 'week2', 'week3', 'week4', 'later'];
        data.forEach(row => {
            const tr = document.createElement('tr');
            displayColumns.forEach(col => {
                const td = document.createElement('td'); let value = row[col];
                if (formatColumns.includes(col) && isValidNumber(value)) { value = value.toFixed(3); } else if (value === null || value === undefined) { value = '-'; }
                td.textContent = value; tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function addLegendToMapAdvanced() {
        const legend = L.control({ position: 'bottomleft' });
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend'); let legendHtml = '<h4>Onset Probability Period</h4>';
            for (const periodKey in PERIOD_COLORS) { if (PERIOD_COLORS.hasOwnProperty(periodKey)) { const color = PERIOD_COLORS[periodKey]; const label = LEGEND_LABELS[periodKey] || periodKey; legendHtml += '<div class="legend-item"><i style="background:' + color + '"></i> ' + label + '</div>'; } }
            div.innerHTML = legendHtml; return div;
        };
        legend.addTo(map);
        // Disable map interactions on legend hover
        legend.getContainer().addEventListener('mouseover', () => map.dragging.disable());
        legend.getContainer().addEventListener('mouseout', () => map.dragging.enable());
    }

    function loadDataAdvanced() {
        Papa.parse(csvUrl, {
            download: true, header: true, skipEmptyLines: true, dynamicTyping: true,
            complete: function (results) {
                console.log("CSV Parsing Complete (Advanced):", results);
                if (results.errors.length > 0) console.error("CSV Parsing Errors:", results.errors);
                allGridData = results.data.filter(row =>
                    isValidNumber(row.lat) && isValidNumber(row.lon) && row.time &&
                    isValidNumber(row.week1) && isValidNumber(row.week2) &&
                    isValidNumber(row.week3) && isValidNumber(row.week4) && isValidNumber(row.later)
                );
                if (allGridData.length === 0) console.warn("No valid data rows found (Advanced).");
                else {
                    populateMapAdvanced(allGridData);
                    populateTableAdvanced(allGridData);
                }
            },
            error: function (error) { console.error("Error fetching/parsing CSV (Advanced):", error); }
        });
    }

    // --- Functions for Simple Home Page Map (index.html) ---
    function initHomeMap() {
        homeMap = L.map('home-map', {
            zoomSnap: 0.6,
            minZoom: initialZoom,
            maxZoom: initialZoom,
            zoomControl: false,
            dragging: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            // No tile layer will be added. Background will be the GeoJSON or CSS background.
        }).setView(initialCenter, initialZoom);

        // Create a dedicated pane for the GeoJSON outline on the home map
        homeMap.createPane('geoJsonPaneHome');
        homeMap.getPane('geoJsonPaneHome').style.zIndex = 150; // Lower z-index
        homeMap.getPane('geoJsonPaneHome').style.pointerEvents = 'none'; // Make it non-interactive

        homeMap.createPane('geoJsonPaneHomeState');
        homeMap.getPane('geoJsonPaneHomeState').style.zIndex = 100; // Lower z-index
        homeMap.getPane('geoJsonPaneHomeState').style.pointerEvents = 'none'; // Make it non-interactive

        fetch(indiaGeoPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok for home map GeoJSON: ' + response.statusText);
                }
                return response.json();
            })
            .then(geojsonData => {
                L.geoJSON(geojsonData, {
                    pane: 'geoJsonPaneHome', // Assign to the custom pane
                    style: function (feature) {
                        return {
                            color: "#333333",      // Dark grey outline for India
                            fillColor: "#FFFFFF",  // White fill for India
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0       // Solid white fill
                        };
                    },
                    interactive: false // The GeoJSON layer itself should not be interactive
                }).addTo(homeMap);
                console.log("India GeoJSON layer added to home map.");
            })
            .catch(error => {
                console.error('Error fetching or adding GeoJSON layer to home map:', error);
                alert('Could not load the India map outline for the home page.');
            });
        fetch(indiaStateGeoPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok for home map GeoJSON: ' + response.statusText);
                }
                return response.json();
            })
            .then(geojsonData => {
                L.geoJSON(geojsonData, {
                    pane: 'geoJsonPaneHomeState', // Assign to the custom pane
                    style: function (feature) {
                        return {
                            color: "#333333",      // Dark grey outline for India
                            fillColor: "#FFFFFF",  // White fill for India
                            weight: 0.5,
                            opacity: 0.3,
                            fillOpacity: 1,       // Solid white fill
                            dashArray: '1, 2'
                        };
                    },
                    interactive: false // The GeoJSON layer itself should not be interactive
                }).addTo(homeMap);
                console.log("India GeoJSON layer added to home map.");
            })
            .catch(error => {
                console.error('Error fetching or adding GeoJSON layer to home map:', error);
                alert('Could not load the India map outline for the home page.');
            });            
    }

    function populateHomeMap(data) {
        if (!homeMap) {
            console.error("Home map not initialized before populating.");
            return;
        }
        homeGridLayer = L.layerGroup();

        data.forEach(row => {
            const lat = row.lat;
            const lon = row.lon;
            if (isValidNumber(row.later)) {
            // Only proceed to create the rectangle if 'row.later' is a valid number
            const cellBounds = [[lat - 1.0, lon - 1.0], [lat + 1.0, lon + 1.0]];

            const rectangle = L.rectangle(cellBounds, {
                color: "#555555",    // Border color for grid cells
                weight: 0.8,          // Thin border
                opacity: 1,
                fillColor: "#007bff", // Can be any color or transparent
                fillOpacity: 0.05,     // Very transparent fill, or 0 for no fill
                interactive: true
            });

            const tooltipContent = `Lat: ${lat.toFixed(1)}&deg; N<br>Lon: ${lon.toFixed(1)}&deg; E`; // Added 'Later' value to tooltip
            rectangle.bindTooltip(tooltipContent, {
                sticky: false,
                permanent: false,
                direction: 'top',
                opacity: 0.9,
                className: 'home-tooltip'
            });

            homeGridLayer.addLayer(rectangle);
        }
        });

        homeGridLayer.addTo(homeMap);
        console.log("Home grid layer added to map.");
    }

    function loadDataHome() {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: function (results) {
                console.log("CSV Parsing Complete (Home):", results);
                if (results.errors.length > 0) {
                    console.error("CSV Parsing Errors (Home):", results.errors);
                    alert("Error parsing CSV data for home map. Check console.");
                    return;
                }
                // For home map, we primarily need lat/lon.
                const homePageData = results.data.filter(row =>
                    isValidNumber(row.lat) && isValidNumber(row.lon)
                );

                if (homePageData.length === 0) {
                    console.warn("No valid data rows (lat/lon) found for Home Map.");
                    alert("Warning: No valid forecast data (lat/lon) found in the CSV for home map.");
                } else {
                    populateHomeMap(homePageData);
                }
            },
            error: function (error) {
                console.error("Error fetching or parsing CSV (Home):", error);
                alert("Failed to load forecast data for Home Map.");
            }
        });
    }

    // --- Conditional Initialization ---
    const advancedMapElement = document.getElementById('map');
    const homeMapElement = document.getElementById('home-map');

    if (advancedMapElement) {
        // Initialize for advanced.html
        console.log("Initializing Advanced Map page...");
        initMapAdvanced(); // Renamed
        initChartAdvanced(); // Renamed
        loadDataAdvanced();  // Renamed
        addLegendToMapAdvanced(); // Renamed
    } else if (homeMapElement) {
        // Initialize for index.html
        console.log("Initializing Home Map page...");
        initHomeMap();
        loadDataHome();
    }
    // --- Function to Format Date for Display (e.g., "YYYYMMDD" to "Month Day, Year") ---
    function formatLatestDateForDisplay(rawDateStr) {
        if (typeof rawDateStr === 'string' && rawDateStr.length >= 8) {
            const year = rawDateStr.substring(0, 4);
            const month = rawDateStr.substring(4, 6);
            const day = rawDateStr.substring(6, 8);
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (isNaN(dateObj.getTime())) {
                console.error("Invalid date created from raw string:", rawDateStr);
                return "Invalid date value";
            }
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return dateObj.toLocaleDateString('en-US', options);
        }
        console.error("Raw date string is not in the expected format for display:", rawDateStr);
        return "Date not available";
    }

    // --- NEW Function to Parse Date for Link Attributes (YYYY, MM, DD strings) ---
    function getDatePartsForLink(rawDateStr) {
        // rawDateStr is expected to be like "YYYYMMDDTHH", e.g., "20250514T00"
        if (typeof rawDateStr === 'string' && rawDateStr.length >= 8) {
            const year = rawDateStr.substring(0, 4);
            const month = rawDateStr.substring(4, 6); // e.g., "05"
            const day = rawDateStr.substring(6, 8);   // e.g., "14"

            // Basic validation of parts
            if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
                console.error("Invalid date components in raw string for link:", rawDateStr);
                return null;
            }
            // Further numeric validation could be added if necessary (e.g. month 01-12)
            return {
                yearStr: year,
                monthStrPadded: month, // MM format
                dayStrPadded: day      // DD format
            };
        }
        console.error("Raw date string is not in the expected format for link parts:", rawDateStr);
        return null;
    }


    // --- Function to Fetch and Display the Issued Date (and update download link) ---
    function displayIssuedDateAndSetupDownloadLink() {
        const issueDatePlaceholderElement = document.getElementById('forecast-issue-date');
        const downloadLinkAnchor = document.getElementById('download-forecast-link');
        const downloadLinkDescSpan = document.getElementById('download-link-description');

        fetch(latestDateFilePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok fetching ${latestDateFilePath}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(text => {
                const rawDateStr = text.trim();

                // Update the "Forecast Issued: ..." display
                if (issueDatePlaceholderElement) {
                    const formattedDisplayDate = formatLatestDateForDisplay(rawDateStr);
                    issueDatePlaceholderElement.textContent = `Forecast Issued: ${formattedDisplayDate}`;
                }

                // Update the download link and its description
                const dateParts = getDatePartsForLink(rawDateStr);
                if (dateParts && downloadLinkAnchor && downloadLinkDescSpan) {
                    const { yearStr, monthStrPadded, dayStrPadded } = dateParts;

                    // Update link description text
                    downloadLinkDescSpan.textContent = `latest forecast (issued ${monthStrPadded}/${dayStrPadded})`;

                    // Set the dynamic download filename
                    const downloadFileName = `monsoon_forecast_${yearStr}${monthStrPadded}${dayStrPadded}.csv`;
                    downloadLinkAnchor.setAttribute('download', downloadFileName);

                    // The href still points to the generic 'blend_output_summary.csv'
                } else {
                    if (!dateParts) console.warn("Could not parse date parts for download link.");
                    if (!downloadLinkAnchor) console.warn("Download link anchor element not found.");
                    if (!downloadLinkDescSpan) console.warn("Download link description span not found.");
                }
            })
            .catch(error => {
                console.error('Error fetching or processing issued date file:', error);
                if (issueDatePlaceholderElement) {
                    issueDatePlaceholderElement.textContent = 'Forecast issue date currently unavailable.';
                }
                if (downloadLinkDescSpan) {
                    // Keep generic text if date fails
                    downloadLinkDescSpan.textContent = 'latest forecast';
                }
                if (downloadLinkAnchor) {
                    // Fallback download name if date processing fails
                    downloadLinkAnchor.setAttribute('download', 'forecast_latest.csv');
                }
            });
    }

    // --- Call the function to display the date and set up download link ---
    displayIssuedDateAndSetupDownloadLink();

}); // End DOMContentLoaded