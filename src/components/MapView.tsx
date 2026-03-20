"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import to avoid SSR issues with Leaflet
const MapViewInner = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.6)",
        borderRadius: "12px",
        color: "var(--text-tertiary)",
        fontSize: "14px",
      }}
    >
      Loading map…
    </div>
  ),
});

export interface MapIncident {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  location: string;
  coords: [number, number];
  status: string;
  summary: string;
  casualties: string;
}

interface MapViewProps {
  incidents: MapIncident[];
  selectedId?: string | null;
  onSelectIncident?: (incident: MapIncident) => void;
  center?: [number, number];
  zoom?: number;
}

export default function MapView(props: MapViewProps) {
  return <MapViewInner {...props} />;
}
