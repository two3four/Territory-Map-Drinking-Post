"use client";

import { useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, LayersControl, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import { useMemo, useState, useCallback, useEffect } from "react";
import { MarkerData } from "@/lib/googleSheets";

// Fix for default marker icons in Next.js + Leaflet
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  markers: MarkerData[];
  geojson: any;
  version?: number;
  selectedMarker?: MarkerData | null;
}

export default function MapComponent({ markers, geojson, version = 0, selectedMarker }: MapComponentProps) {
  const geoJsonLayerRef = useRef<L.GeoJSON>(null);
  const [hoverData, setHoverData] = useState<any>(null);
  const [hoveredGeoId, setHoveredGeoId] = useState<string | number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const MouseTracker = () => {
    useMapEvents({
      mousemove(e) {
        setMousePos({ x: e.containerPoint.x, y: e.containerPoint.y });
      },
    });
    return null;
  };

  // CREATE PREMIUM CUSTOM PINK ICON
  const customMarkerIcon = useMemo(() => L.divIcon({
    className: 'custom-pin-container',
    html: `
      <div class="pin-wrapper">
        <div class="pin-pulse"></div>
        <div class="pin-main">
          <div class="pin-inner"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  }), []);

  const ViewUpdater = ({ marker }: { marker?: MarkerData | null }) => {
    const map = useMapEvents({});
    const lastMarkerRef = useRef<string | null>(null);

    useEffect(() => {
      if (marker && marker.Latitude !== undefined && marker.Longitude !== undefined) {
        // Only fly if this is a DIFFERENT marker than the last one we flew to
        // or the first time we see a marker.
        const markerKey = `${marker.Latitude}-${marker.Longitude}-${marker.Name}`;
        if (lastMarkerRef.current !== markerKey) {
          map.flyTo([marker.Latitude, marker.Longitude], 10, { 
            duration: 1.5,
            easeLinearity: 0.25
          });
          lastMarkerRef.current = markerKey;
        }
      } else if (!marker) {
        lastMarkerRef.current = null;
      }
    }, [marker, map]);
    return null;
  };

  // PRE-CALCULATE: Map which counties have markers once when markers/geojson change
  const activeCountyIds = useMemo(() => {
    if (!geojson || !markers.length) return new Set();

    const activeIds = new Set<string | number>();
    const points = turf.featureCollection(
      markers.map(m => turf.point([m.Longitude, m.Latitude]))
    );

    geojson.features.forEach((feature: any) => {
      try {
        const ptsWithin = turf.pointsWithinPolygon(points, feature);
        if (ptsWithin.features.length > 0) {
          activeIds.add(feature.properties.GEOID || feature.properties.NAME);
        }
      } catch (e) {
        // Skip invalid geometries
      }
    });

    return activeIds;
  }, [geojson, markers]);

  const styleFeature = (feature: any) => {
    const status = (feature.properties.Status || "").toLowerCase();
    const isCircle = feature.properties.isCircle;
    const geoId = feature.properties.GEOID || feature.properties.NAME;
    const isHovered = geoId === hoveredGeoId;

    // Default style (Empty/NULL)
    let style: any = {
      fillColor: "transparent",
      weight: isHovered ? 2 : 1,
      opacity: 1,
      color: "black",
      fillOpacity: 0
    };

    if (status === "yes") {
      style = {
        fillColor: "#1881B7", // Deep Blue
        weight: isHovered ? 2 : 1,
        opacity: 1,
        color: "#1881B7",
        fillOpacity: 0.5
      };
    } else if (status === "circle" || isCircle) {
      style = {
        fillColor: "#808080", // Gray
        weight: isHovered ? 2 : 1,
        opacity: 1,
        color: "#808080",
        fillOpacity: 0.8,
        className: "premium-circle"
      };
    }

    if (isHovered) {
      style.weight = 2;
      style.color = "#0f172a";
    }

    return style;
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    layer.on({
      mouseover: (e) => {
        const geoId = feature.properties.GEOID || feature.properties.NAME;
        setHoveredGeoId(geoId);
        setHoverData({
          name: feature.properties.NAME,
          state: feature.properties.State || feature.properties.STATE_NAME,
          status: feature.properties.Status,
          business: feature.properties.Business_n,
          isCircle: feature.properties.isCircle
        });

        const target = e.target;
        target.setStyle({
          weight: 2,
          color: "#0f172a",
          fillOpacity: 0.9
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          target.bringToFront();
        }
      },
      mousemove: (e) => {
        setMousePos({ x: e.containerPoint.x, y: e.containerPoint.y });
      },
      mouseout: (e) => {
        setHoveredGeoId(null);
        setHoverData(null);
        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.resetStyle(e.target);
        }
      }
    });
  };

  const defaultCenter: [number, number] = [39.8283, -98.5795];

  return (
    <div className="h-full w-full relative group">
      {/* SVG Definitions and STYLES for Premium Pins */}
      <style jsx global>{`
        .custom-pin-container {
          background: transparent;
          border: none;
        }
        .pin-wrapper {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .pin-main {
          width: 24px;
          height: 24px;
          background: #1881B7;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2;
        }
        .pin-inner {
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          transform: rotate(45deg);
        }
        .pin-pulse {
          position: absolute;
          width: 40px;
          height: 40px;
          background: rgba(24, 129, 183, 0.4);
          border-radius: 50%;
          animation: pin-pulse-anim 2s infinite;
          z-index: 1;
        }
        @keyframes pin-pulse-anim {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .premium-circle {
          filter: url(#floatShadow);
          fill: url(#sphereGradient) !important;
          stroke: #64748b;
          stroke-width: 1.5px;
          transition: all 0.3s ease;
        }
      `}</style>

      {/* ... previous SVG defs ... */}
      <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden="true">
        <defs>
          <radialGradient id="sphereGradient" cx="35%" cy="35%" r="60%" fx="25%" fy="25%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
          <filter id="floatShadow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="12" stdDeviation="8" floodColor="#000000" floodOpacity="0.45" />
          </filter>
        </defs>
      </svg>

      <MapContainer
        center={defaultCenter}
        zoom={4}
        className="h-full w-full"
        zoomControl={true}
        preferCanvas={true}
      >
        <MouseTracker />
        <ViewUpdater marker={selectedMarker} />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street View">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite View">
            <TileLayer
              attribution='&copy; Google'
              url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="US Counties">
            {geojson && (
              <GeoJSON
                data={geojson}
                style={styleFeature}
                onEachFeature={(feature, layer) => {
                  onEachFeature(feature, layer);
                  const status = (feature.properties.Status || "").toLowerCase();
                  const label = status === "yes" ? "Active" :
                    (status === "circle" ? "Circle" : "Not Active");

                  layer.bindPopup(`
                <div class="font-sans">
                  <h3 class="font-bold text-[#004792] text-sm">${feature.properties.NAME}</h3>
                  <p class="text-[10px] text-gray-600">${feature.properties.State || ""}</p>
                  <p class="mt-2 text-[11px]"><strong>Status:</strong> ${label}</p>
                  ${feature.properties.Business_n ? `<p class="text-[11px]"><strong>Business:</strong> ${feature.properties.Business_n}</p>` : ""}
                </div>
              `);
                }}
                ref={geoJsonLayerRef}
                key={`map-layer-${version}`}
              />
            )}
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Dealer Pins">
            {markers
              .filter(m => m.HasExactCoordinates && !isNaN(m.Latitude) && !isNaN(m.Longitude))
              .map((m, idx) => (
                <Marker 
                  key={`dealer-pin-${idx}-${version}`} 
                  position={[m.Latitude, m.Longitude]}
                  icon={customMarkerIcon}
                >
                  <Popup>
                    <div className="font-sans min-w-[160px] p-1">
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Official Dealer</div>
                      <h3 className="font-bold text-[#1881B7] text-sm leading-tight">
                        {m.BusinessName || m.Name}
                      </h3>
                      {m.County && (
                        <p className="text-[10px] text-blue-600 font-semibold mb-2">
                          {m.County} County
                        </p>
                      )}
                      <div className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-wider mb-2 border border-blue-100 shadow-sm">
                        Verified Location
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </LayersControl.Overlay>
        </LayersControl>
      </MapContainer>
      {/* ULTRA SMOOTH FLOATING TOOLTIP */}
      {hoverData && (
        <div
          className="absolute pointer-events-none z-[1000] bg-white px-3 py-2 rounded-lg shadow-2xl border border-gray-200 transform -translate-x-1/2 -translate-y-[120%] transition-all duration-75 flex flex-col items-center min-w-[160px]"
          style={{
            left: mousePos.x,
            top: mousePos.y,
          }}
        >
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">County Details</div>
          <div className="text-sm font-black text-[#0f172a] text-center leading-tight">
            {hoverData.name}<br />
            <span className="text-blue-600 text-xs font-bold">{hoverData.state}</span>
          </div>
          <div className={`text-[9px] mt-2 font-black px-2 py-0.5 rounded shadow-sm border ${(hoverData.status || "").toLowerCase() === 'yes'
            ? 'bg-blue-600 text-white border-blue-700'
            : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
            {(hoverData.status || "").toLowerCase() === 'yes' ? 'ACTIVE TERRITORY' :
              ((hoverData.status || "").toLowerCase() === 'circle' ? 'CIRCLE ZONE' : 'NOT ACTIVE')}
          </div>
          {/* Tooltip Arrow */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 border-b border-r border-gray-200"></div>
        </div>
      )}
    </div>
  );
}
