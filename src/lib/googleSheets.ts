import Papa from "papaparse";

export interface MarkerData {
  Name: string;
  Latitude: number;
  Longitude: number;
  Status: string;
}

export async function fetchSheetData(): Promise<MarkerData[]> {
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTPWnmKhskrLM4_J4gxt2RE8Xtjiah1XiIMpIz92LjWlkfjzu2B8Bge_6gfnSvtxrgroFftxd7tvCtW/pub?output=csv";
  
  try {
    const res = await fetch(CSV_URL, {
      next: { revalidate: 60 } // Revalidate every 60 seconds
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch spreadsheet: ${res.statusText}`);
    }
    
    const csvText = await res.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Normalize case and properties
          const markers = results.data.map((row: any) => ({
            Name: row.Name || row.name || "Unknown",
            Latitude: parseFloat(row.Latitude || row.latitude || row.lat),
            Longitude: parseFloat(row.Longitude || row.longitude || row.long || row.lng),
            Status: row.Status || row.status || "Active"
          })).filter(m => !isNaN(m.Latitude) && !isNaN(m.Longitude));
          
          resolve(markers);
        },
        error: (error: any) => {
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return [];
  }
}
