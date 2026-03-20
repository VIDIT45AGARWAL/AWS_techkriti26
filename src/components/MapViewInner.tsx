"use client";

import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { MapIncident } from "./MapView";

// ─── Custom Marker Icons by Severity ───

function createSeverityIcon(severity: string, isSelected: boolean): L.DivIcon {
  const colors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#3b82f6",
    low: "#10b981",
  };
  const color = colors[severity] || colors.medium;
  const size = isSelected ? 18 : 12;
  const outerSize = isSelected ? 32 : 24;
  const pulseSize = isSelected ? 48 : 36;

  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="
        position: relative;
        width: ${outerSize}px;
        height: ${outerSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: ${pulseSize}px;
          height: ${pulseSize}px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.2;
          animation: mapPulse 2s ease-in-out infinite;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        "></div>
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 12px ${color}80, 0 2px 8px rgba(0,0,0,0.4);
          z-index: 2;
          transition: all 0.2s ease;
        "></div>
      </div>
    `,
    iconSize: [outerSize, outerSize],
    iconAnchor: [outerSize / 2, outerSize / 2],
    popupAnchor: [0, -outerSize / 2],
  });
}

// ─── Component to fly to selected incident ───

function FlyToSelected({
  coords,
  selectedId,
}: {
  coords: [number, number] | null;
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 12, { duration: 0.8 });
    }
  }, [coords, selectedId, map]);

  return null;
}

// ─── Inject global CSS for marker animation ───

function InjectStyles() {
  useEffect(() => {
    const styleId = "map-marker-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes mapPulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.2; }
        50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
      }
      .custom-map-marker {
        background: transparent !important;
        border: none !important;
      }
      .leaflet-container {
        background: #0f172a !important;
        font-family: inherit;
      }
      .leaflet-popup-content-wrapper {
        background: rgba(15, 23, 42, 0.95) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
        color: #e2e8f0 !important;
        backdrop-filter: blur(12px);
      }
      .leaflet-popup-content {
        margin: 12px 16px !important;
        font-size: 13px !important;
        line-height: 1.5 !important;
      }
      .leaflet-popup-tip {
        background: rgba(15, 23, 42, 0.95) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
      }
      .leaflet-popup-close-button {
        color: #94a3b8 !important;
        font-size: 18px !important;
      }
      .leaflet-control-zoom a {
        background: rgba(15, 23, 42, 0.9) !important;
        color: #e2e8f0 !important;
        border-color: rgba(255,255,255,0.1) !important;
      }
      .leaflet-control-zoom a:hover {
        background: rgba(30, 41, 59, 0.95) !important;
      }
      .leaflet-control-attribution {
        background: rgba(15, 23, 42, 0.7) !important;
        color: #64748b !important;
        font-size: 10px !important;
      }
      .leaflet-control-attribution a {
        color: #94a3b8 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  return null;
}

// ─── Main Map Inner Component ───

interface MapViewInnerProps {
  incidents: MapIncident[];
  selectedId?: string | null;
  onSelectIncident?: (incident: MapIncident) => void;
  center?: [number, number];
  zoom?: number;
}

const severityLabels: Record<string, { label: string; color: string }> = {
  critical: { label: "CRITICAL", color: "#ef4444" },
  high: { label: "HIGH", color: "#f59e0b" },
  medium: { label: "MEDIUM", color: "#3b82f6" },
  low: { label: "LOW", color: "#10b981" },
};

export default function MapViewInner({
  incidents,
  selectedId = null,
  onSelectIncident,
  center = [22.5, 78.9], // Center of India
  zoom = 5,
}: MapViewInnerProps) {
  const selectedIncident = incidents.find((i) => i.id === selectedId);
  const flyToCoords = selectedIncident ? selectedIncident.coords : null;

  return (
    <>
      <InjectStyles />
      <MapContainer
        center={center}
        zoom={zoom}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "12px",
          minHeight: "400px",
        }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* Dark-themed CartoDB tiles for the dark UI */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <FlyToSelected coords={flyToCoords} selectedId={selectedId} />

        {incidents.map((incident) => (
          <Marker
            key={incident.id}
            position={incident.coords}
            icon={createSeverityIcon(
              incident.severity,
              incident.id === selectedId
            )}
            eventHandlers={{
              click: () => onSelectIncident?.(incident),
            }}
          >
            <Popup>
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      background: `${severityLabels[incident.severity]?.color || "#3b82f6"}20`,
                      color:
                        severityLabels[incident.severity]?.color || "#3b82f6",
                    }}
                  >
                    {severityLabels[incident.severity]?.label || "UNKNOWN"}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                    }}
                  >
                    {incident.id}
                  </span>
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    marginBottom: "4px",
                    color: "#f1f5f9",
                  }}
                >
                  {incident.type}
                </div>
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                  📍 {incident.location}
                </div>
                {incident.casualties !== "None" &&
                  incident.casualties !== "None reported" && (
                    <div
                      style={{
                        color: "#fbbf24",
                        fontSize: "12px",
                        marginTop: "4px",
                      }}
                    >
                      ⚠ {incident.casualties}
                    </div>
                  )}
                <div
                  style={{
                    color: "#cbd5e1",
                    fontSize: "12px",
                    marginTop: "6px",
                    lineHeight: 1.4,
                  }}
                >
                  {incident.summary}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
