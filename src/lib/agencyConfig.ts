export interface AgencyConfig {
  slug: string;
  label: string;
  /** Exact value stored in `departments[]` in DynamoDB */
  apiName: string;
  icon: string; // lucide icon name
  color: string;
  colorRgb: string;
  gradient: string;
  description: string;
  incidentTypes: string[];
}

export const AGENCIES: AgencyConfig[] = [
  {
    slug: "fire",
    label: "Fire Department",
    apiName: "Fire Department",
    icon: "Flame",
    color: "#ef4444",
    colorRgb: "239, 68, 68",
    gradient: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
    description: "Structural fires, gas leaks, rescue operations",
    incidentTypes: ["Building Fire", "Gas Leak", "Wildfire", "Explosion"],
  },
  {
    slug: "police",
    label: "Police",
    apiName: "Police",
    icon: "Shield",
    color: "#3b82f6",
    colorRgb: "59, 130, 246",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
    description: "Theft, assault, criminal incidents, traffic",
    incidentTypes: ["Theft", "Theft in Progress", "Assault", "Road Accident"],
  },
  {
    slug: "medical",
    label: "Medical Emergency",
    apiName: "Medical Emergency",
    icon: "Heart",
    color: "#10b981",
    colorRgb: "16, 185, 129",
    gradient: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
    description: "Medical emergencies, injuries, critical care",
    incidentTypes: ["Medical Emergency", "Snake Bite", "Cardiac Arrest"],
  },
  {
    slug: "disaster",
    label: "Disaster Response",
    apiName: "Disaster Response",
    icon: "CloudLightning",
    color: "#f59e0b",
    colorRgb: "245, 158, 11",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
    description: "Floods, earthquakes, building collapse, natural disasters",
    incidentTypes: ["Flooding", "Building Collapse", "Earthquake", "Landslide"],
  },
];

export function getAgencyBySlug(slug: string): AgencyConfig | undefined {
  return AGENCIES.find((a) => a.slug === slug);
}
