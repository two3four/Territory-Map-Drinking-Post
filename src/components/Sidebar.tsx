"use client";

import { useState, useRef, useEffect } from "react";
import { MarkerData } from "@/lib/googleSheets";
import { RefreshCw, MapPin, Search, ChevronDown } from "lucide-react";

interface SidebarProps {
  markers: MarkerData[];
  onRefresh: () => void;
  isLoading: boolean;
  selectedMarker?: MarkerData | null;
  onSelectMarker?: (marker: MarkerData | null) => void;
}

export default function Sidebar({ markers, onRefresh, isLoading, selectedMarker, onSelectMarker }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMarkers = markers.filter(m => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (m.Name && m.Name.toLowerCase().includes(term)) ||
      (m.County && m.County.toLowerCase().includes(term)) ||
      (m.BusinessName && m.BusinessName.toLowerCase().includes(term))
    );
  });

  const dropdownSuggestions = filteredMarkers.slice(0, 100); // limit dropdown size for performance

  const handleSelect = (marker: MarkerData) => {
    if (onSelectMarker) onSelectMarker(marker);
    setSearchTerm(marker.Name);
    setIsDropdownOpen(false);
  };

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

      {/* Search Bar / Dropdown Combo */}
      <div className="p-4 border-b bg-gray-50 flex-shrink-0 z-[1001]" ref={dropdownRef}>
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-gray-400" size={16} />
            <input
              type="text"
              className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all"
              placeholder="Search dealer or county..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
            />
            <ChevronDown 
              className={`absolute right-3 text-gray-400 cursor-pointer transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
              size={16} 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            />
          </div>
          
          {/* Dropdown Suggestions */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-[1002]">
              {dropdownSuggestions.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">No results found</div>
              ) : (
                dropdownSuggestions.map((marker, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelect(marker)}
                    className="p-3 border-b last:border-b-0 hover:bg-[var(--brand-secondary)] cursor-pointer transition-colors"
                  >
                    <div className="font-medium text-sm text-gray-800">{marker.Name}</div>
                    {(marker.BusinessName || marker.County) && (
                       <div className="text-xs text-gray-500 mt-0.5">
                         {marker.BusinessName ? `Dealer: ${marker.BusinessName}` : ''}
                         {marker.BusinessName && marker.County ? ' | ' : ''}
                         {marker.County ? `County: ${marker.County}` : ''}
                       </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMarkers.length === 0 && !isLoading && (
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

        {filteredMarkers.map((marker, idx) => (
          <div
            key={idx}
            onClick={() => handleSelect(marker)}
            className={`group border p-4 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white cursor-pointer relative overflow-hidden ${selectedMarker?.Latitude === marker.Latitude && selectedMarker?.Longitude === marker.Longitude ? 'border-[var(--brand-primary)] shadow-md ring-1 ring-[var(--brand-primary)]' : 'border-gray-100'}`}
          >
            <div className={`absolute top-0 left-0 w-1 h-full transition-opacity ${selectedMarker?.Latitude === marker.Latitude && selectedMarker?.Longitude === marker.Longitude ? 'bg-[var(--brand-primary)] opacity-100' : 'bg-[var(--brand-accent)] opacity-0 group-hover:opacity-100'}`} />

            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full flex-shrink-0 transition-colors ${selectedMarker?.Latitude === marker.Latitude && selectedMarker?.Longitude === marker.Longitude ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--brand-secondary)] text-[var(--brand-primary)] group-hover:bg-[var(--brand-accent)] group-hover:text-white'}`}>
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
                
                {/* Removed Exact Location tag and coordinates as per user request */}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t bg-gray-50 text-xs font-medium text-gray-500 flex justify-between items-center tracking-wide">
        <span>TOTAL SHOWING</span>
        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{filteredMarkers.length}</span>
      </div>
    </div>
  );
}
