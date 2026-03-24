const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const excelPath = path.resolve(__dirname, '..', '..', 'geometry and important data.xlsx');
const scriptPath = path.resolve(__dirname, 'update-data.js');

console.log(`Watching for changes in: ${excelPath}`);

let timer = null;

function runUpdate() {
    console.log(`\nChange detected in Excel file. Regenerating GeoJSON...`);
    try {
        const output = execSync('npm run generate-map', { encoding: 'utf-8' });
        console.log(output);
        console.log('Update complete.');
    } catch (error) {
        console.error('Update failed:', error.message);
    }
}

// Simple debounce to handle multiple fast saves
fs.watch(excelPath, (eventType, filename) => {
    if (filename && eventType === 'change') {
        if (timer) clearTimeout(timer);
        timer = setTimeout(runUpdate, 1000); // Wait 1 second after last change
    }
});
