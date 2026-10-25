"use client";

import React from "react";
import dynamic from "next/dynamic";

// Dynamically import to avoid SSR issues with Leaflet
const MapViewInner = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-canvas text-[13px] text-muted">
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
