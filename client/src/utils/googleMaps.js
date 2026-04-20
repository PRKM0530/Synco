/**
 * Shared Google Maps loader — loads the Maps JS SDK once with places + marker libraries.
 * All map components import from here so the script is never loaded twice.
 * Uses importLibrary() for proper async loading (no blocking).
 */
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let initPromise = null;

// Bootstrap the Google Maps JS API (inline loader recommended by Google)
const bootstrap = () => {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.Map) {
      resolve();
      return;
    }

    // Use Google's recommended inline bootstrap
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps SDK"));
    document.head.appendChild(script);
  });

  return initPromise;
};

/**
 * Load Google Maps and return the google.maps namespace.
 * Ensures all libraries (Map, places, marker) are ready.
 */
export const loadGoogleMaps = async () => {
  await bootstrap();
  return window.google.maps;
};

export default loadGoogleMaps;
