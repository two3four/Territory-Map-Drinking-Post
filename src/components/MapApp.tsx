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
      const geojsonData = await fetch(`/counties.geojson?t=${Date.now()}`).then(res => res.json()).catch(() => null);

      if (geojsonData) {
        setGeojson(geojsonData);

        // Extract markers from features that have a Status
        const activeFeatures = geojsonData.features.filter((f: any) => f.properties.Status);
        const derivedMarkers: MarkerData[] = activeFeatures.map((f: any) => {
          const centroid = turf.centroid(f);
          return {
            Name: f.properties.NAME || f.properties.Business_n || "Unknown",
            Status: f.properties.Status,
            Latitude: centroid.geometry.coordinates[1],
            Longitude: centroid.geometry.coordinates[0]
          };
        });
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
    setIsLoadingData(true);
    try {
      await fetch('/api/update-map', { method: 'POST' });
      await loadData();
    } catch (error) {
      console.error("Failed to generate and load data:", error);
      setIsLoadingData(false);
    }
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
