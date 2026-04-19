import L from "leaflet";

/**
 * Category → color + SVG icon path (Lucide icons, 24×24 viewBox)
 * Each category gets a unique shape via the marker's clip-path/SVG background.
 */
const CATEGORY_CONFIG = {
  Sports: {
    color: "#e74c3c",
    shape: "circle",
    // Trophy icon
    icon: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4 22h16" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  Music: {
    color: "#9b59b6",
    shape: "circle",
    // Music icon
    icon: `<path d="M9 18V5l12-2v13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="6" cy="18" r="3" stroke="white" stroke-width="2" fill="none"/><circle cx="18" cy="16" r="3" stroke="white" stroke-width="2" fill="none"/>`,
  },
  Tech: {
    color: "#3498db",
    shape: "hexagon",
    // Cpu icon
    icon: `<rect x="4" y="4" width="16" height="16" rx="2" stroke="white" stroke-width="2" fill="none"/><rect x="9" y="9" width="6" height="6" stroke="white" stroke-width="2" fill="none"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  },
  Gaming: {
    color: "#e67e22",
    shape: "rounded-square",
    // Gamepad icon
    icon: `<line x1="6" y1="11" x2="10" y2="11" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="9" x2="8" y2="13" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="15" y1="12" x2="15.01" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="10" x2="18.01" y2="10" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  Outdoors: {
    color: "#27ae60",
    shape: "diamond",
    // Tent icon
    icon: `<path d="M3.5 21 14 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M20.5 21 10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M15.5 21 12 15l-3.5 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M2 21h20" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  },
  Food: {
    color: "#f39c12",
    shape: "circle",
    // Utensils icon
    icon: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M7 2v20" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  Arts: {
    color: "#e91e63",
    shape: "flower",
    // Palette icon
    icon: `<circle cx="13.5" cy="6.5" r="0.5" fill="white" stroke="white" stroke-width="1"/><circle cx="17.5" cy="10.5" r="0.5" fill="white" stroke="white" stroke-width="1"/><circle cx="8.5" cy="7.5" r="0.5" fill="white" stroke="white" stroke-width="1"/><circle cx="6.5" cy="12.5" r="0.5" fill="white" stroke="white" stroke-width="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" stroke="white" stroke-width="2" fill="none"/>`,
  },
  Networking: {
    color: "#2b5a8e",
    shape: "circle",
    // Users icon
    icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="9" cy="7" r="4" stroke="white" stroke-width="2" fill="none"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  },
  Fitness: {
    color: "#2ecc71",
    shape: "shield",
    // Dumbbell icon
    icon: `<path d="m6.5 6.5 11 11" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="m21 21-1-1" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="m3 3 1 1" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="m18 22 4-4" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="m2 6 4-4" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="m3 10 7-7" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><path d="m14 21 7-7" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  },
  Other: {
    color: "#95a5a6",
    shape: "circle",
    // MapPin icon
    icon: `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="10" r="3" stroke="white" stroke-width="2" fill="none"/>`,
  },
};

/**
 * Build an SVG shape background for the marker.
 * Returns the SVG path/element for the outer shape.
 */
const getShapeSVG = (shape, color) => {
  switch (shape) {
    case "hexagon":
      return `<polygon points="22,12 17,2 7,2 2,12 7,22 17,22" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    case "rounded-square":
      return `<rect x="2" y="2" width="20" height="20" rx="5" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    case "diamond":
      return `<polygon points="12,1 23,12 12,23 1,12" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    case "shield":
      return `<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1z" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    case "flower":
      return `<circle cx="12" cy="5" r="4.5" fill="${color}"/><circle cx="5" cy="12" r="4.5" fill="${color}"/><circle cx="19" cy="12" r="4.5" fill="${color}"/><circle cx="12" cy="19" r="4.5" fill="${color}"/><circle cx="12" cy="12" r="6" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    case "circle":
    default:
      return `<circle cx="12" cy="12" r="11" fill="${color}" stroke="white" stroke-width="1.5"/>`;
  }
};

/**
 * Create a Leaflet DivIcon for a given activity category.
 * Returns a cached icon instance.
 */
const iconCache = {};

export const getCategoryMarkerIcon = (category) => {
  if (iconCache[category]) return iconCache[category];

  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
  const { color, shape, icon } = config;

  const shapeSvg = getShapeSVG(shape, color);

  // Outer marker: shape background + icon + pointer triangle
  const html = `
    <div class="category-marker" style="--marker-color: ${color}">
      <div class="category-marker-bubble">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          ${shapeSvg}
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" class="category-marker-icon">
          ${icon}
        </svg>
      </div>
      <div class="category-marker-pointer">
        <svg width="12" height="7" viewBox="0 0 14 8">
          <polygon points="0,0 7,8 14,0" fill="${color}"/>
        </svg>
      </div>
    </div>
  `;

  const divIcon = new L.DivIcon({
    className: "category-marker-wrapper",
    html,
    iconSize: [36, 45],
    iconAnchor: [18, 45],
    popupAnchor: [0, -45],
  });

  iconCache[category] = divIcon;
  return divIcon;
};

export default getCategoryMarkerIcon;
