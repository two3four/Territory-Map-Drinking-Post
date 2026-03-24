const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const os = require('os');
const turf = require('@turf/turf');

const zipPath = path.join(__dirname, '..', 'data', 'counties_with_states.zip');
const outputPath = path.join(__dirname, '..', 'public', 'counties.geojson');

async function convert() {
  console.log(`Reading zipped shapefile from: ${zipPath}`);
  
  // Extract zip to a temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shp-'));
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tmpDir, true);
    console.log(`Extracted zip to temp dir: ${tmpDir}`);

    // Find the .shp file inside the extracted directory
    const shpFile = files.find(f => f.endsWith('.shp')); 
    if (!shpFile) {
      throw new Error('No .shp file found inside the zip archive!');
    }
    
    const shpPath = path.join(tmpDir, shpFile);
    console.log(`Reading shapefile: ${shpPath}`);

    const features = [];
    const source = await shapefile.open(shpPath);

    while (true) {
      const result = await source.read();
      if (result.done) break;
      
      const feature = result.value;
      
      // 1. Simplify geometry (Tolerance 0.005 is usually good for regional maps)
      const simplified = turf.simplify(feature, { tolerance: 0.005, highQuality: false });
      
      // 2. Filter properties to keep file size small
      simplified.properties = {
        NAME: feature.properties.NAME,
        STATE_NAME: feature.properties.State || feature.properties.STATE_NAME,
        GEOID: feature.properties.GEOID
      };

      // 3. Round coordinates to 4 decimal places (~11m precision)
      if (simplified.geometry) {
        roundCoordinates(simplified.geometry.coordinates);
      }

      features.push(simplified);
    }

    const geojson = { type: "FeatureCollection", features };
    console.log(`Successfully read and simplified ${features.length} features.`);

    // Ensure public directory exists
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(geojson));
    console.log(`Successfully saved optimized GeoJSON to: ${outputPath}`);
  } finally {
    // Cleanup temp dir
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

convert();
