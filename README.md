# Territory Map Application

A modern, interactive internal web map built for Drinking Post to visualize regional territories and active locations. It automatically pairs Google Sheets coordinate data with an embedded US Counties shapefile layer to seamlessly highlight regions dynamically.

## Features
- **Live Google Sheets Sync**: Fetches locations interactively from a public Google Sheet without manual exports.
- **Dynamic Polygon Mapping**: Points are automatically mapped into US counties. Counties containing markers become dynamically highlighted.
- **Modern UI**: Styled with Tailwind CSS to match dpwaterer.com's clean, robust branding.

## Prerequisites
- Node.js 18.x or later installed locally.
- Git.

## Initial Setup & Data Processing
The application requires county definitions formatted as a GeoJSON file, converted from the local `.shp` file.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Process the provided shapefile (`counties_with_states.shp`) into a web-readable `GeoJSON`:
   ```bash
   npm run generate-map
   # Which essentially runs: node scripts/convert-shapefile.js
   ```

3. Run the application locally:
   ```bash
   npm run dev
   ```

## Deployment via Vercel

The application is built with Next.js and optimized for deployment on [Vercel](https://vercel.com).

### 1. Push Code to GitHub
Ensure the project is tracking in Git, then push it to your GitHub account:
```bash
git init
git add .
git commit -m "Initial commit for Territory Map App"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Deploy on Vercel
1. Log in to [Vercel](https://vercel.com) using your GitHub account.
2. Click **Add New Project**.
3. Import the Github repository you just created.
4. Leave the default settings (Framework Preset: Next.js).
5. Click **Deploy**.

Since Next.js fetching will execute the `/public/counties.geojson` file, make sure that `public/counties.geojson` has been successfully committed to GitHub after you run the setup data processing step!

## Updating the Map Data
The interactive map automatically queries the Google Spreadsheet every 60 seconds (using Next.js `revalidate`). Whenever a row is added or updated in the Google Sheet (Name, Latitude, Longitude, Status), simply use the **Refresh Data** button in the sidebar or refresh the browser mapping tool. It will automatically re-process spatial clustering without needing to re-deploy.
