"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { MapIncident } from "./MapView";
import { SEVERITY_LABEL, SEVERITY_TONE, TONE_VAR } from "@/lib/tone";

// ─── Quiet markers: severity tone, no glow ───

function createSeverityIcon(severity: string, isSelected: boolean): L.DivIcon {
  const tone = SEVERITY_TONE[severity] ?? "info";
  const color = `var(${TONE_VAR[tone]})`;
  const size = isSelected ? 13 : 10;

  return L.divIcon({
    className: "awaaz-marker",
    html: `
      <div style="position: relative; width: ${size * 2.4}px; height: ${size * 2.4}px;
        display: flex; align-items: center; justify-content: center;">
        ${
          isSelected
            ? `<div style="position: absolute; inset: 0; border-radius: 9999px;
                border: 1px solid var(--accent); animation: mapPulse 2s ease-in-out infinite;"></div>`
            : ""
        }
        <div style="width: ${size}px; height: ${size}px; border-radius: 9999px;
          background: ${color};
          border: 2px solid var(--panel);
          z-index: 2;"></div>
      </div>
    `,
    iconSize: [size * 2.4, size * 2.4],
    iconAnchor: [size * 1.2, size * 1.2],
    popupAnchor: [0, -size * 1.2],
  });
}

// ─── Fly to the selected incident ───

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

// ─── Marker pulse keyframe (respects reduced motion via globals) ───

function InjectStyles() {
  useEffect(() => {
    const styleId = "awaaz-map-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes mapPulse {
        0%, 100% { transform: scale(0.7); opacity: 1; }
        50% { transform: scale(1.25); opacity: 0.35; }
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

// ─── Tiles: OpenStreetMap raster (keyless). Dark mode is applied in CSS ───
// (globals.css inverts the tile pane; Carto's free basemaps now demand an API key.)

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// ─── Main map inner component ───

interface MapViewInnerProps {
  incidents: MapIncident[];
  selectedId?: string | null;
  onSelectIncident?: (incident: MapIncident) => void;
  center?: [number, number];
  zoom?: number;
}

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
        className="size-full rounded-[inherit]"
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={TILE_URL}
        />

        <FlyToSelected coords={flyToCoords} selectedId={selectedId} />

        {incidents.map((incident) => (
          <Marker
            key={incident.id}
            position={incident.coords}
            icon={createSeverityIcon(incident.severity, incident.id === selectedId)}
            eventHandlers={{
              click: () => onSelectIncident?.(incident),
            }}
          >
            <Popup>
              <p
                className="text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ color: `var(${TONE_VAR[SEVERITY_TONE[incident.severity] ?? "info"]})` }}
              >
                {SEVERITY_LABEL[incident.severity] ?? "Severity unknown"}
              </p>
              <p className="mt-1 text-[13.5px] font-medium">{incident.type}</p>
              <p className="text-muted">{incident.location}</p>
              {incident.casualties !== "None" && incident.casualties !== "None reported" ? (
                <p className="mt-1 text-warn">Casualties: {incident.casualties}</p>
              ) : null}
              <p className="mt-1.5 text-muted leading-[1.5]">{incident.summary}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
