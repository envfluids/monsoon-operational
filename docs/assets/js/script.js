document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration (mostly shared) ---
    const csvUrl = 'assets/data/message_templates_output_eng.csv';
    const initialCenter = [23, 79.9629]; // Approx center of India
    const initialZoom = 4.3;
    const indiaGeoPath = 'assets/geography/india_country.geojson';
    const indiaStateGeoPath = 'assets/geography/india_states.geojson';
    const latestDateFilePath = 'assets/data/latest.txt';

    // Variables for advanced map

    // Variables for home map
    let homeMap;
    let homeGridLayer;

    function isValidNumber(value) {
        return typeof value === 'number' && !isNaN(value);
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

            if (isValidNumber(lat) && isValidNumber(lon) && row.forecast_message) {
                const rawMessage = row.forecast_message;
                let messageHtml = 'Forecast details not available.'; // Default message if processing results in empty

                if (typeof rawMessage === 'string' && rawMessage.trim() !== '') {
                    let messageContent = rawMessage;
                    const firstNewlineIndex = messageContent.indexOf('\n');

                    if (firstNewlineIndex !== -1) {
                        // If a newline character exists, take the substring *after* the first newline.
                        // This effectively removes the first line.
                        messageContent = messageContent.substring(firstNewlineIndex + 1);
                    } else {
                        // If there's no newline character, it means the message is a single line.
                        // Removing the "first line" of a single-line message means the message becomes empty.
                        messageContent = "";
                    }

                    // Now, replace any remaining newline characters in the (potentially modified) messageContent
                    // with <br> tags for HTML display.
                    messageHtml = messageContent.replace(/\n\n/g, '<br>');

                    // If after removing the first line, the messageHtml is empty (or only whitespace),
                    // set a default placeholder.
                    if (messageHtml.trim() === '') {
                        messageHtml = 'Forecast details not available.';
                    }

                } else if (rawMessage) { // If it exists but isn't a string (e.g. null, undefined but not empty)
                    console.warn(`Forecast message for lat: ${lat}, lon: ${lon} is not a string:`, rawMessage);
                    messageHtml = 'Forecast data invalid.';
                }
                // If rawMessage was undefined or null from the start,
                // messageHtml will remain 'Forecast details not available.'

                const cellBounds = [[lat - 1.0, lon - 1.0], [lat + 1.0, lon + 1.0]];

                const rectangle = L.rectangle(cellBounds, {
                    color: "#555555",
                    weight: 0.8,
                    opacity: 1,
                    fillColor: "#007bff",
                    fillOpacity: 0.05,
                    interactive: true
                });

                const tooltipContent = `Lat: ${lat.toFixed(1)}&deg; N, Lon: ${lon.toFixed(1)}&deg; E<br>${messageHtml}`;
                rectangle.bindTooltip(tooltipContent, {
                    // sticky: false,
                    // permanent: false,
                    direction: 'top',
                    opacity: 0.9,
                    className: 'home-tooltip'
                });

                homeGridLayer.addLayer(rectangle);
            } else {
                if (!isValidNumber(lat) || !isValidNumber(lon)) {
                    // console.warn("Skipping row due to invalid lat/lon:", row);
                } else if (!isValidNumber(row.later)) {
                    // console.log(`Skipping row for home map (lat: ${lat}, lon: ${lon}) because 'row.later' is not a valid number:`, row.later);
                }
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
    const homeMapElement = document.getElementById('home-map');

    if (homeMapElement) {
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
                    issueDatePlaceholderElement.textContent = `Forecast Issued ${formattedDisplayDate}`;
                }

                // Update the download link and its description
                const dateParts = getDatePartsForLink(rawDateStr);
                if (dateParts && downloadLinkAnchor && downloadLinkDescSpan) {
                    const { yearStr, monthStrPadded, dayStrPadded } = dateParts;

                    // Update link description text
                    downloadLinkDescSpan.textContent = `latest forecast messages`;

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