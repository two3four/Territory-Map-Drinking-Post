"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import * as turf from "@turf/turf";
import Sidebar from "./Sidebar";
import { MarkerData } from "@/lib/googleSheets";

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

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const geojsonData = await fetch(`/counties.geojson`).then(res => res.json()).catch(() => null);

      if (geojsonData) {
        // Fetch LIVE data from Google Sheets via browser directly to bypass Vercel serverless restrictions!
        const sheetUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRhehLlJ-ay1vxSTCs7wwdetEPindGJebs62ibjpeYqnB6DQzz8N5sa2h6xtiBKE0WeufcHqXhrkXkN/pub?output=csv&t=${Date.now()}`;
        const csvRes = await fetch(sheetUrl);
        const csvText = await csvRes.text();
        const Papa = await import('papaparse');
        
        const parsed = Papa.default.parse(csvText, { header: true, skipEmptyLines: true });
        
        const liveDataByGeoId: Record<string, any> = {};
        parsed.data.forEach((row: any) => {
            if (row.GEOID) {
                const geoId = String(row.GEOID).replace(/[^0-9]/g, '').padStart(5, '0');
                liveDataByGeoId[geoId] = row;
            }
        });

        const activeFeatures: any[] = [];
        
        // Clone features properly to avoid permanently losing original boundaries when switching statuses
        const featuresCopy = geojsonData.features.map((f: any) => ({
            ...f,
            properties: { ...f.properties }
        }));

        featuresCopy.forEach((f: any) => {
            const geoId = String(f.properties.GEOID).replace(/[^0-9]/g, '').padStart(5, '0');
            const liveRow = liveDataByGeoId[geoId];
            
            if (liveRow) {
                f.properties.Status = liveRow.Status || null;
                f.properties.Business_n = liveRow.Business_n || f.properties.Business_n || "";
                
                const status = (f.properties.Status || "").toLowerCase().trim();
                
                if (status === 'circle') {
                     if (!f.properties.originalGeometry) {
                         f.properties.originalGeometry = f.geometry;
                     }
                     try {
                         const tempFeature = { ...f, geometry: f.properties.originalGeometry };
                         const centroid = turf.centroid(tempFeature);
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
                } else {
                     if (f.properties.originalGeometry) {
                         f.geometry = f.properties.originalGeometry;
                     }
                     f.properties.isCircle = false;
                }

                if (f.properties.Status) {
                    activeFeatures.push(f);
                }
            } else {
                f.properties.Status = null;
                if (f.properties.originalGeometry) {
                    f.geometry = f.properties.originalGeometry;
                }
            }
        });

        const derivedMarkers: MarkerData[] = activeFeatures.map((f: any) => {
          const centroid = turf.centroid(f);
          return {
            Name: f.properties.NAME || f.properties.Business_n || "Unknown",
            Status: f.properties.Status,
            Latitude: centroid.geometry.coordinates[1],
            Longitude: centroid.geometry.coordinates[0]
          };
        });

        setGeojson(geojsonData);
        setMarkers(derivedMarkers);
        setDataVersion(Date.now());
      }
    } catch (error) {
      console.error("Failed to load map data:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const refreshData = async () => {
    // Simply re-fetch the live sheet using loadData
    await loadData();
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
        <Sidebar markers={markers} onRefresh={refreshData} isLoading={isLoadingData} />

        {/* Map */}
        <div className="flex-1 relative z-0">
          <MapComponent markers={markers} geojson={geojson} version={dataVersion} />
        </div>
      </main>
    </div>
  );
}
