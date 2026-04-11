const XLSX = require('xlsx');
const shapefile = require('shapefile');
const turf = require('@turf/turf');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const os = require('os');

// Adjusted paths relative to the script location
const excelPath = path.resolve(__dirname, '..', '..', 'geometry and important data.xlsx');
const zipPath = path.resolve(__dirname, '..', 'data', 'counties_with_states.zip');
const outputPath = path.resolve(__dirname, '..', 'public', 'counties.geojson');

async function run() {
    console.log(`Reading Excel file from: ${excelPath}`);
    console.log(`Reading shapefile from: ${zipPath}`);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shp-'));

    try {
        // 1. Fetch CSV from Google Sheets
        const Papa = require('papaparse');
        // Use the published URL provided by the user
        const sheetUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRhehLlJ-ay1vxSTCs7wwdetEPindGJebs62ibjpeYqnB6DQzz8N5sa2h6xtiBKE0WeufcHqXhrkXkN/pub?output=csv&t=${Date.now()}`;
        
        console.log(`Fetching data from Google Sheet: ${sheetUrl}`);
        const response = await fetch(sheetUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Google Sheet: ${response.statusText}`);
        }
        const csvText = await response.text();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        const excelData = parsed.data;

        // Map excel data by GEOID for quick lookup
        const excelByGeoId = {};
        excelData.forEach(row => {
            if (row.GEOID) {
                const geoId = String(row.GEOID).replace(/[^0-9]/g, '').padStart(5, '0');
                excelByGeoId[geoId] = row;
            }
        });

        console.log(`Loaded ${Object.keys(excelByGeoId).length} unique entries from Excel.`);

        // 2. Extract Shapefile
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(tmpDir, true);
        const files = fs.readdirSync(tmpDir);
        const shpFile = files.find(f => f.endsWith('.shp'));
        if (!shpFile) throw new Error('No .shp file found in zip');
        const shpPath = path.join(tmpDir, shpFile);

        // 3. Process Features
        const features = [];
        const source = await shapefile.open(shpPath);

        while (true) {
            const result = await source.read();
            if (result.done) break;

            const feature = result.value;
            const geoId = String(feature.properties.GEOID).replace(/[^0-9]/g, '').padStart(5, '0');
            const excelRow = excelByGeoId[geoId] || {};

            // Merge properties
            let properties = {
                ...feature.properties,
                ...excelRow,
                Status: excelRow.Status || null,
                isCircle: false
            };

            delete properties.geom_wkt;

            let geometry = feature.geometry;
            const status = (properties.Status || '').toLowerCase();

            // Handle "Circle" status with new dynamic logic
            if (status === 'circle') {
                try {
                    const centroid = turf.centroid(feature);

                    // Convert polygon to line for distance calculation
                    // handle MultiPolygon by converting to feature and getting perimeter
                    const boundary = turf.polygonToLine(feature);

                    // Distance to boundary in meters
                    const distanceToBoundary = turf.pointToLineDistance(centroid, boundary, { units: 'meters' });

                    let radius;
                    if (distanceToBoundary <= 100) {
                        // Reduced/internal circle (approx 1/4 size)
                        // Minimum 25m if space allows, or scaled
                        radius = Math.max(25, distanceToBoundary * 0.25);
                        console.log(`Small boundary detected for ${geoId} (${properties.NAME}): ${distanceToBoundary.toFixed(2)}m. Using radius: ${radius.toFixed(2)}m`);
                    } else {
                        // Adjust according to available space
                        // We use 30 miles (48280m) but cap it at 80% of distance to boundary
                        // to ensure it stays mostly internal/clean if requested
                        radius = Math.min(48280, distanceToBoundary * 0.8);
                    }

                    const buffer = turf.buffer(centroid, radius, { units: 'meters', steps: 256 });
                    geometry = buffer.geometry;
                    properties.isCircle = true;
                    properties.bufferRadius = radius;
                } catch (err) {
                    console.error(`Error calculating dynamic buffer for ${geoId}:`, err.message);
                }
            }

            // Simplify and round coordinates
            const simplified = turf.simplify(turf.feature(geometry, properties), { tolerance: 0.005, highQuality: false });

            if (simplified.geometry) {
                roundCoordinates(simplified.geometry.coordinates);
            }

            features.push(simplified);
        }

        const geojson = turf.featureCollection(features);

        // 4. Save Output
        const publicDir = path.dirname(outputPath);
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(geojson));
        console.log(`Successfully saved ${features.length} features to: ${outputPath}`);

    } catch (error) {
        console.error('Failed to update data:', error.message);
        process.exit(1);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function roundCoordinates(coords) {
    if (Array.isArray(coords)) {
        for (let i = 0; i < coords.length; i++) {
            if (typeof coords[i] === 'number') {
                coords[i] = Math.round(coords[i] * 10000) / 10000;
            } else {
                roundCoordinates(coords[i]);
            }
        }
    }
}

run();
