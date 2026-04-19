import { useEffect, useState, useRef } from "react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";

// Load with Places library for autocomplete
const LIBRARIES = ["places"];

const MapPicker = ({ onLocationSelect, onAddressChange, initialLocation }) => {
  const parseLocation = (loc) => {
    if (!loc) return null;
    if (Array.isArray(loc)) {
      return { lat: loc[0], lng: loc[1] };
    }
    return loc;
  };

  const parsedInitial = parseLocation(initialLocation);

  const [center, setCenter] = useState(
    parsedInitial || { lat: 28.6139, lng: 77.209 } // Default to Delhi
  );
  const [position, setPosition] = useState(parsedInitial);

  useEffect(() => {
    if (initialLocation) {
      const pLoc = parseLocation(initialLocation);
      if (pLoc) {
        setCenter(pLoc);
        setPosition(pLoc);
      }
    }
  }, [initialLocation]);
  const [error, setError] = useState("");
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  // Get user location on mount
  useEffect(() => {
    if (!initialLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCenter(loc);
            setPosition(loc);
            if (onLocationSelect) onLocationSelect([loc.lat, loc.lng]);
          },
          () => {
            setError("Could not detect location. Search or click the map to set location.");
          },
          { timeout: 5000 },
        );
      }
    }
  }, []);

  // Initialize Google Places Autocomplete on the input
  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;
    if (autocompleteRef.current) return; // Already initialised

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode", "establishment"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) {
        setError("Could not find this location. Try another search.");
        return;
      }
      setError("");
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const loc = { lat, lng };
      setCenter(loc);
      setPosition(loc);
      if (onLocationSelect) onLocationSelect([lat, lng]);
      // Update address field in parent if callback provided
      if (onAddressChange) {
        onAddressChange(place.formatted_address || place.name || "");
      }
    });

    autocompleteRef.current = autocomplete;
  }, [isLoaded]);

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const loc = { lat, lng };
    setPosition(loc);
    if (onLocationSelect) onLocationSelect([lat, lng]);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {isLoaded && (
        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder="Search for a place, address, or landmark..."
          style={{ width: "100%" }}
        />
      )}

      {error && (
        <span style={{ color: "var(--color-warning)", fontSize: "var(--text-xs)" }}>
          {error}
        </span>
      )}

      <div
        style={{
          height: "300px",
          width: "100%",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          border: "1px solid var(--color-border)",
        }}
      >
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={{ height: "100%", width: "100%" }}
            center={center}
            zoom={13}
            onClick={handleMapClick}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              clickableIcons: false,
            }}
          >
            {position && (
              <MarkerF position={position} />
            )}
          </GoogleMap>
        )}
      </div>

      {position && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-success)" }}>
          ✓ Location pinned: {position.lat?.toFixed(5)}, {position.lng?.toFixed(5)}
        </p>
      )}

      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
        Search for a location above, or click anywhere on the map to pin the exact spot.
      </p>
    </div>
  );
};

export default MapPicker;
