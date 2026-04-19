import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, Loader } from "lucide-react";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Load Google Places JS (only the places library, not the full maps SDK)
let googleReady = false;
let googleReadyPromise = null;
const loadGooglePlaces = () => {
  if (googleReady) return Promise.resolve();
  if (googleReadyPromise) return googleReadyPromise;
  googleReadyPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      googleReady = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => { googleReady = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return googleReadyPromise;
};

// Click handler component
const ClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
};

// Recenter helper
const RecenterMap = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center]);
  return null;
};

const MapPicker = ({ onLocationSelect, onAddressChange, initialLocation }) => {
  const parseLocation = (loc) => {
    if (!loc) return null;
    if (Array.isArray(loc)) return [loc[0], loc[1]];
    return [loc.lat, loc.lng];
  };

  const parsedInitial = parseLocation(initialLocation);
  const defaultCenter = [28.6139, 77.209];

  const [center, setCenter] = useState(parsedInitial || defaultCenter);
  const [position, setPosition] = useState(parsedInitial);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const googleLoadedRef = useRef(false);

  // Load Google Places on mount
  useEffect(() => {
    loadGooglePlaces().then(() => {
      googleLoadedRef.current = true;
    }).catch((err) => {
      console.error("Google Places failed to load:", err);
    });
  }, []);

  useEffect(() => {
    if (initialLocation) {
      const pLoc = parseLocation(initialLocation);
      if (pLoc) {
        setCenter(pLoc);
        setPosition(pLoc);
      }
    }
  }, [initialLocation]);

  // Get user location on mount if no initial
  useEffect(() => {
    if (!initialLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          setCenter(loc);
          setPosition(loc);
          if (onLocationSelect) onLocationSelect(loc);
        },
        () => {
          setError("Could not detect location. Search or click the map to set location.");
        },
        { timeout: 5000 },
      );
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions via new Google Places AutocompleteSuggestion API
  const fetchSuggestions = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      if (!googleLoadedRef.current || !window.google?.maps?.places?.AutocompleteSuggestion) {
        setSearching(false);
        return;
      }
      try {
        const response = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
        });
        const results = (response.suggestions || []).map((s) => {
          const pred = s.placePrediction;
          return {
            placeId: pred.placeId,
            name: pred.mainText?.text || pred.text?.text || "",
            detail: pred.secondaryText?.text || "",
            label: pred.text?.text || "",
          };
        });
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIdx(-1);
      } catch (err) {
        console.error("Autocomplete error:", err);
        setSuggestions([]);
        setShowSuggestions(false);
      }
      setSearching(false);
    }, 250);
  }, []);

  // Get lat/lng from a placeId via new Place class
  const getPlaceDetails = useCallback(async (placeId, label) => {
    if (!window.google?.maps?.places?.Place) return;
    try {
      const place = new window.google.maps.places.Place({ id: placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      const lat = place.location.lat();
      const lng = place.location.lng();
      const loc = [lat, lng];
      const address = place.formattedAddress || label;
      setCenter(loc);
      setPosition(loc);
      setError("");
      if (onLocationSelect) onLocationSelect(loc);
      if (onAddressChange) onAddressChange(address);
    } catch (err) {
      console.error("Place details error:", err);
    }
  }, [onLocationSelect, onAddressChange]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchSuggestions(val);
  };

  const selectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
    getPlaceDetails(suggestion.placeId, suggestion.label);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
        selectSuggestion(suggestions[selectedIdx]);
      } else if (suggestions.length > 0) {
        selectSuggestion(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleMapClick = (latlng) => {
    const loc = [latlng.lat, latlng.lng];
    setPosition(loc);
    if (onLocationSelect) onLocationSelect(loc);
    // Reverse geocode via Google Geocoder
    if (window.google?.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat: latlng.lat, lng: latlng.lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const address = results[0].formatted_address;
          setSearchQuery(address);
          if (onAddressChange) onAddressChange(address);
        }
      });
    }
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {/* Search with autosuggest */}
      <div ref={wrapperRef} style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "var(--color-text-muted)", pointerEvents: "none",
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search for a place, address, or landmark..."
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              style={{ width: "100%", paddingLeft: 36 }}
              autoComplete="off"
            />
            {searching && (
              <Loader
                size={16}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  color: "var(--color-text-muted)", animation: "spin 1s linear infinite",
                }}
              />
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 1000,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              marginTop: 4,
              padding: 0,
              listStyle: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => selectSuggestion(s)}
                onMouseEnter={() => setSelectedIdx(i)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  background: i === selectedIdx ? "var(--color-primary-light, rgba(43,90,142,0.08))" : "transparent",
                  borderBottom: i < suggestions.length - 1 ? "1px solid var(--color-border)" : "none",
                  transition: "background 0.15s",
                }}
              >
                <MapPin size={16} style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}
                  </div>
                  {s.detail && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.detail}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <RecenterMap center={center} />
          <ClickHandler onMapClick={handleMapClick} />
          {position && <Marker position={position} />}
        </MapContainer>
      </div>

      {position && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-success)" }}>
          ✓ Location pinned: {position[0]?.toFixed(5)}, {position[1]?.toFixed(5)}
        </p>
      )}

      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
        Search for a location above, or click anywhere on the map to pin the exact spot.
      </p>
    </div>
  );
};

export default MapPicker;
