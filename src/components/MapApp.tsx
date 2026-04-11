"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import * as turf from "@turf/turf";
import Sidebar from "./Sidebar";
import { MarkerData, fetchSheetData } from "@/lib/googleSheets";

// Dynamically import Leaflet component, SSR false
const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50/50 backdrop-blur-sm z-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)] mb-4"></div>
      <p className="text-[var(--brand-primary)] font-medium animate-pulse">Loading Territory Map...</p>
    </div>
  )
}) as any;

export default function MapApp() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [geojson, setGeojson] = useState<any>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [baseGeojson, setBaseGeojson] = useState<any>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);

  const loadData = async (forceRefresh = false) => {
    setIsLoadingData(true);
    try {
      let geojsonData = baseGeojson;
      
      // Only fetch the heavy 2.4MB GeoJSON if we don't already have it
      if (!geojsonData) {
        console.log("Loading base GeoJSON for the first time...");
        geojsonData = await fetch(`/counties.geojson`).then(res => res.json()).catch(() => null);
        if (geojsonData) {
            setBaseGeojson(geojsonData);
        }
      }

      if (geojsonData) {
        // Fetch LIVE data from Google Sheets - this is very small and fast!
        const sheetId = "19ebXOn7uwi8ZimzpXQZXx0SIDku5PBgz1-fq4HPO8VQ";
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&t=${Date.now()}`;
        
        console.log("Fetching live spreadsheet data...");
        const csvRes = await fetch(sheetUrl);
        const csvText = await csvRes.text();
        const Papa = await import('papaparse');
        
        const parsed = Papa.default.parse(csvText, { header: true, skipEmptyLines: true });
        
        // Also fetch the explicit pins from the secondary sheet
        console.log("Fetching explicit dealer pins...");
        const explicitPins = await fetchSheetData();
        
        const liveDataByGeoId: Record<string, any> = {};
        parsed.data.forEach((row: any) => {
            if (row.GEOID) {
                const geoId = String(row.GEOID).replace(/[^0-9]/g, '').padStart(5, '0');
                liveDataByGeoId[geoId] = row;
            }
        });

        const activeFeatures: any[] = [];
        
        // Use the geojson to create the mapped view
        geojsonData.features.forEach((f: any) => {
            const geoId = String(f.properties.GEOID).replace(/[^0-9]/g, '').padStart(5, '0');
            const liveRow = liveDataByGeoId[geoId];
            
            if (liveRow) {
                f.properties.Status = liveRow.Status || null;
                f.properties.Business_n = liveRow.Business_n || f.properties.Business_n || "";
                f.properties.Latitude = liveRow.Latitude || liveRow.latitude || liveRow.lat || null;
                f.properties.Longitude = liveRow.Longitude || liveRow.longitude || liveRow.long || liveRow.lng || null;
                
                const status = (f.properties.Status || "").toLowerCase().trim();
                
                if (status === 'circle') {
                     // Cache the original geometry if we haven't yet
                     if (!f.properties.originalGeometry) {
                         f.properties.originalGeometry = f.geometry;
                     }
                     
                     // Optimization: Only re-calculate circle if we don't have one cached for this radius
                     if (!f.properties.isCircle) {
                         try {
                             const centroid = turf.centroid(f);
                             const tempFeature = { ...f, geometry: f.properties.originalGeometry };
                             const boundary = turf.polygonToLine(tempFeature);
                             const dist = turf.pointToLineDistance(centroid, boundary as any, { units: 'meters' });
                             
                             let radius = (dist <= 100) ? Math.max(25, dist * 0.25) : Math.min(48280, dist * 0.8);
                             const buffer = turf.buffer(centroid, radius, { units: 'meters', steps: 64 });
                             if (buffer) {
                                 f.geometry = buffer.geometry;
                             }
                             f.properties.isCircle = true;
                         } catch(err) {
                             console.error("Circle error on ", geoId, err);
                         }
                     }
                } else {
                     // Restore original shape if it's no longer a circle
                     if (f.properties.isCircle && f.properties.originalGeometry) {
                         f.geometry = f.properties.originalGeometry;
                     }
                     f.properties.isCircle = false;
                }

                if (f.properties.Status) {
                    activeFeatures.push(f);
                }
            } else {
                f.properties.Status = null;
                if (f.properties.isCircle && f.properties.originalGeometry) {
                    f.geometry = f.properties.originalGeometry;
                }
                f.properties.isCircle = false;
            }
        });

        const derivedMarkers: MarkerData[] = activeFeatures.map((f: any) => {
          const centroid = turf.centroid(f);
          const countyName = f.properties.NAME || "";
          const businessName = f.properties.Business_n || "";
          
          const latStr = f.properties.Latitude;
          const lngStr = f.properties.Longitude;
          let lat = centroid.geometry.coordinates[1];
          let lng = centroid.geometry.coordinates[0];
          
          if (latStr && !isNaN(parseFloat(latStr))) {
             lat = parseFloat(latStr);
          }
          if (lngStr && !isNaN(parseFloat(lngStr))) {
             lng = parseFloat(lngStr);
          }
          
          return {
            Name: businessName ? `${businessName} (${countyName})` : countyName || "Unknown",
            County: countyName,
            BusinessName: businessName,
            Status: f.properties.Status,
            Latitude: lat,
            Longitude: lng,
            HasExactCoordinates: !!latStr && !!lngStr
          };
        });

        // Also extract any pins from the CSV that have Lat/Lng coordinates
        const csvPins: MarkerData[] = [];
        parsed.data.forEach((row: any) => {
          // Dealer 1
          const lat1 = row.Lat || row.Latitude || row.latitude || row.lat;
          const lng1 = row.Long || row.Longitude || row.longitude || row.long || row.lng;
          if (lat1 && lng1 && !isNaN(parseFloat(lat1)) && !isNaN(parseFloat(lng1))) {
            csvPins.push({
              Name: row.Business_n || row.Business || row.NAME || row.Name || "Unnamed Dealer",
              County: row.County || row.NAME || "",
              BusinessName: row.Business_n || row.Business || "",
              Status: row.Status || "Active",
              Latitude: parseFloat(lat1),
              Longitude: parseFloat(lng1),
              HasExactCoordinates: true
            });
          }

          // Dealer 2
          const lat2 = row['Lat 2'] || row.Lat2 || row.latitude2;
          const lng2 = row['Long 2'] || row.Long2 || row.longitude2;
          if (lat2 && lng2 && !isNaN(parseFloat(lat2)) && !isNaN(parseFloat(lng2))) {
            csvPins.push({
              Name: row.Business_2 || row.Business2 || `${row.Business_n || row.Business || "Unnamed"} (Store 2)`,
              County: row.County || row.NAME || "",
              BusinessName: row.Business_2 || row.Business2 || "",
              Status: row.Status || "Active",
              Latitude: parseFloat(lat2),
              Longitude: parseFloat(lng2),
              HasExactCoordinates: true
            });
          }
        });

        // Combine derived markers and explicit pins intelligently
        // We want to avoid showing both a "County Center" and an "Exact Pin" for the same business.
        const finalMarkers: MarkerData[] = [];
        
        // 1. Add all exact pins (Dealer 1 and Dealer 2)
        finalMarkers.push(...csvPins);

        // 2. Add derived markers (county centers) ONLY if that county/business doesn't already have an exact pin
        derivedMarkers.forEach(derived => {
            const hasExact = csvPins.some(pin => 
                pin.BusinessName === derived.BusinessName && 
                pin.County === derived.County
            );
            if (!hasExact) {
                finalMarkers.push(derived);
            }
        });
        
        console.log(`Final markers after deduplication: ${finalMarkers.length}`);
        
        console.log(`Loaded ${derivedMarkers.length} markers derived from counties.`);
        console.log(`Loaded ${csvPins.length} pins from primary CSV (including Lat/Long 2).`);
        console.log(`Loaded ${explicitPins.length} explicit pins from secondary sheet.`);

        explicitPins.forEach(pin => {
          // Avoid duplicates if they happen to share names exactly
          if (!finalMarkers.some(m => m.Name === pin.Name)) {
            finalMarkers.push({
              ...pin,
              HasExactCoordinates: true
            });
          }
        });

        console.log(`Total markers in state: ${finalMarkers.length}`);
        const coordinateCount = finalMarkers.filter(m => m.HasExactCoordinates).length;
        console.log(`Markers with exact coordinates: ${coordinateCount}`);

        // Trigger a re-render of the map component
        setMarkers(finalMarkers);
        setGeojson({...geojsonData}); // Spread to force React to see as new object
        setDataVersion(Date.now());
      }
    } catch (error) {
      console.error("Failed to load map data:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const refreshData = async () => {
    // We already have the base geojson, so this will only fetch the small CSV!
    await loadData(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8fafc] overflow-hidden text-gray-900">
      {/* Header aligned strictly with Drinking Post's clean industrial/agricultural vibe */}
      <header className="h-[72px] bg-white border-b shadow-sm flex items-center justify-between px-8 z-20 relative">
        <div className="flex items-center gap-4">
          {/* Faux logo representation for the brand */}
          <div className="w-10 h-10 bg-[var(--brand-primary)] rounded-md flex items-center justify-center text-white font-bold text-xl shadow-inner">
            DP
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--brand-primary)]">
              DRINKING POST
            </h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest pl-[1px]">
              Territory Map
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar 
          markers={markers} 
          onRefresh={refreshData} 
          isLoading={isLoadingData} 
          selectedMarker={selectedMarker}
          onSelectMarker={setSelectedMarker}
        />

        {/* Map */}
        <div className="flex-1 relative z-0">
          <MapComponent 
            markers={markers} 
            geojson={geojson} 
            version={dataVersion} 
            selectedMarker={selectedMarker}
          />
        </div>
      </main>
    </div>
  );
}
