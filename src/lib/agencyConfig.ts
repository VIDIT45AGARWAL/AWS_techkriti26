export interface AgencyConfig {
  slug: string;
  label: string;
  /** Compact label used in shared nav links. */
  shortLabel: string;
  /** Exact value stored in `departments[]` in DynamoDB */
  apiName: string;
  /** Token color family from globals.css: info | critical | ok | warn */
  tone: "info" | "critical" | "ok" | "warn";
  description: string;
  incidentTypes: string[];
}

export const AGENCIES: AgencyConfig[] = [
  {
    slug: "fire",
    label: "Fire Department",
    shortLabel: "Fire",
    apiName: "Fire Department",
    tone: "critical",
    description: "Structural fires, gas leaks, rescue operations",
    incidentTypes: ["Building Fire", "Gas Leak", "Wildfire", "Explosion"],
  },
  {
    slug: "police",
    label: "Police",
    shortLabel: "Police",
    apiName: "Police",
    tone: "info",
    description: "Theft, assault, criminal incidents, traffic",
    incidentTypes: ["Theft", "Theft in Progress", "Assault", "Road Accident"],
  },
  {
    slug: "medical",
    label: "Medical Emergency",
    shortLabel: "Medical",
    apiName: "Medical Emergency",
    tone: "ok",
    description: "Medical emergencies, injuries, critical care",
    incidentTypes: ["Medical Emergency", "Snake Bite", "Cardiac Arrest"],
  },
  {
    slug: "disaster",
    label: "Disaster Response",
    shortLabel: "Disaster",
    apiName: "Disaster Response",
    tone: "warn",
    description: "Floods, earthquakes, building collapse, natural disasters",
    incidentTypes: ["Flooding", "Building Collapse", "Earthquake", "Landslide"],
  },
];

export function getAgencyBySlug(slug: string): AgencyConfig | undefined {
  return AGENCIES.find((a) => a.slug === slug);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
