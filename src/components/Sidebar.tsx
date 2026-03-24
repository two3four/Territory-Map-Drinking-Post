"use client";

import { MarkerData } from "@/lib/googleSheets";
import { RefreshCw, MapPin } from "lucide-react";

interface SidebarProps {
  markers: MarkerData[];
  onRefresh: () => void;
  isLoading: boolean;
}

export default function Sidebar({ markers, onRefresh, isLoading }: SidebarProps) {
  return (
    <div className="w-80 h-full bg-white shadow-[4px_0_24px_rgba(0,0,0,0.1)] flex flex-col z-[1000] relative">
      <div className="p-5 border-b flex justify-between items-center bg-[var(--brand-secondary)] border-b-[var(--brand-primary)] border-b-2">
        <h2 className="text-lg font-bold text-[var(--brand-primary)] tracking-tight">Locations</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 bg-[var(--brand-primary)] text-white rounded hover:bg-[var(--brand-accent)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
          title="Refresh Data"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {markers.length === 0 && !isLoading && (
          <div className="text-center py-10 text-gray-400 italic">
            No locations found.
          </div>
        )}

        {isLoading && markers.length === 0 && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-20 w-full" />
            ))}
          </div>
        )}

        {markers.map((marker, idx) => (
          <div
            key={idx}
            className="group border border-gray-100 p-4 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--brand-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-start gap-3">
              <div className="bg-[var(--brand-secondary)] p-2 rounded-full text-[var(--brand-primary)] flex-shrink-0 group-hover:bg-[var(--brand-accent)] group-hover:text-white transition-colors">
                <MapPin size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 leading-tight">{marker.Name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-2 inline-block ${marker.Status.toLowerCase() === 'yes'
                  ? 'bg-[#1881B7] text-white shadow-sm'
                  : (marker.Status.toLowerCase() === 'circle' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700')
                  }`}>
                  {marker.Status.toLowerCase() === 'yes' ? 'Active' : (marker.Status.toLowerCase() === 'circle' ? 'Circle' : marker.Status)}
                </span>
                <p className="text-xs text-gray-400 mt-2 font-mono">
                  {marker.Latitude.toFixed(3)}, {marker.Longitude.toFixed(3)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t bg-gray-50 text-xs font-medium text-gray-500 flex justify-between items-center tracking-wide">
        <span>TOTAL ENTRIES</span>
        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{markers.length}</span>
      </div>
    </div>
  );
}
