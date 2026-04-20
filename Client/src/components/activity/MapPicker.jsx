import { useEffect, useState, useRef, useCallback } from "react";
import { MapPin, Search, Loader } from "lucide-react";
import { loadGoogleMaps } from "../../utils/googleMaps";

const MapPicker = ({ onLocationSelect, onAddressChange, initialLocation }) => {
  const parseLocation = (loc) => {
    if (!loc) return null;
    if (Array.isArray(loc)) return { lat: loc[0], lng: loc[1] };
    return { lat: loc.lat, lng: loc.lng };
  };

  const parsedInitial = parseLocation(initialLocation);
  const defaultCenter = { lat: 28.6139, lng: 77.209 };

  const [position, setPosition] = useState(parsedInitial);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef(null);
  const mapDivRef = useRef(null);
  const markerRef = useRef(null);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const centerRef = useRef(parsedInitial || defaultCenter);

  // Init Google Map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !mapDivRef.current) return;

      const map = new google.maps.Map(mapDivRef.current, {
        center: centerRef.current,
        zoom: 13,
        mapId: "synco-picker",
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
      });
      mapRef.current = map;

      // Click to pin
      map.addListener("click", (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        placeMarker({ lat, lng }, map);
        if (onLocationSelect) onLocationSelect([lat, lng]);
        // Reverse geocode
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            setSearchQuery(results[0].formatted_address);
            if (onAddressChange) onAddressChange(results[0].formatted_address);
          }
        });
      });

      // Place initial marker
      if (parsedInitial) {
        placeMarker(parsedInitial, map);
      }

      setMapReady(true);
    }).catch(() => {
      setError("Failed to load Google Maps.");
    });

    return () => { cancelled = true; };
  }, []);

  // Get user location on mount if no initial
  useEffect(() => {
    if (!initialLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          centerRef.current = loc;
          setPosition(loc);
          if (mapRef.current) {
            mapRef.current.setCenter(loc);
            placeMarker(loc, mapRef.current);
          }
          if (onLocationSelect) onLocationSelect([loc.lat, loc.lng]);
        },
        () => {
          setError("Could not detect location. Search or click the map to set location.");
        },
        { timeout: 5000 },
      );
    }
  }, []);

  const placeMarker = (pos, map) => {
    if (markerRef.current) {
      markerRef.current.position = pos;
    } else if (window.google?.maps?.marker?.AdvancedMarkerElement) {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
      });
    }
    setPosition(pos);
  };

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

  // Fetch suggestions via Google Places AutocompleteSuggestion API
  const fetchSuggestions = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      if (!window.google?.maps?.places?.AutocompleteSuggestion) {
        setSearching(false);
        return;
      }
      try {
        const response = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
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
      const place = new google.maps.places.Place({ id: placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      const lat = place.location.lat();
      const lng = place.location.lng();
      const pos = { lat, lng };
      const address = place.formattedAddress || label;
      if (mapRef.current) {
        mapRef.current.panTo(pos);
        placeMarker(pos, mapRef.current);
      }
      setError("");
      if (onLocationSelect) onLocationSelect([lat, lng]);
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
        ref={mapDivRef}
        style={{
          height: "300px",
          width: "100%",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          background: "#e8e8e8",
        }}
      />

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
