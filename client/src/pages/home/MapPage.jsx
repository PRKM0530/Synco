import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader, MapPin } from "lucide-react";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import { activityAPI, sosAPI } from "../../services/api";
import { createCategoryMarkerElement } from "../../utils/categoryMarkers";
import { loadGoogleMaps } from "../../utils/googleMaps";
import { getSocket } from "../../services/socket";
import { useAuth } from "../../context/AuthContext";

// Haversine-ish radius in km from google.maps bounds
const getRadiusFromBounds = (map) => {
  const bounds = map.getBounds();
  if (!bounds) return 10;
  const center = bounds.getCenter();
  const ne = bounds.getNorthEast();
  const R = 6371; // km
  const dLat = ((ne.lat() - center.lat()) * Math.PI) / 180;
  const dLng = ((ne.lng() - center.lng()) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((center.lat() * Math.PI) / 180) *
      Math.cos((ne.lat() * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.ceil(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

const getInitialCenter = () => {
  try {
    const cached = localStorage.getItem("synco_last_location");
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  return null; // no cache yet
};

const MapPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [sosSignals, setSosSignals] = useState([]);
  // null means we have no location yet (first ever visit)
  const [center, setCenter] = useState(getInitialCenter);
  const [loading, setLoading] = useState(true);
  const [activityCount, setActivityCount] = useState(0);
  const [sosActionId, setSosActionId] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const clustererRef = useRef(null);
  const markersRef = useRef(new Map()); // id → AdvancedMarkerElement
  const sosMarkersRef = useRef(new Map()); // id → AdvancedMarkerElement
  const infoWindowRef = useRef(null);
  const debounceRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const searchWrapperRef = useRef(null);

  // Pre-load Google Maps SDK in parallel with geolocation.
  useEffect(() => {
    loadGoogleMaps();
  }, []);

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      // No geolocation support — fall back to default only if no cache
      if (!center) setCenter(DEFAULT_CENTER);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        // Save for next visit so map opens instantly on their area
        try {
          localStorage.setItem("synco_last_location", JSON.stringify(userLocation));
        } catch (_) {}

        // If map is already initialised (cached center was used),
        // just pan silently — no flicker, no reinit
        if (mapRef.current) {
          mapRef.current.panTo(userLocation);
          if (userMarkerRef.current) {
            userMarkerRef.current.position = userLocation;
          }
        } else {
          // Map not init yet (first visit, was waiting for center)
          setCenter(userLocation);
        }

        setLoading(false);
      },
      () => {
        // Denied or timed out — use cache or hardcoded fallback
        if (!center) setCenter(DEFAULT_CENTER);
        setLoading(false);
      },
      { timeout: 5000 },
    );
  }, []);

  // Fetch activities for visible bounds (debounced)
  const fetchForBounds = useCallback(async (map) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const c = map.getCenter();
      const radius = getRadiusFromBounds(map);
      try {
        const res = await activityAPI.getActivities({
          lat: c.lat(),
          lng: c.lng(),
          radius,
        });
        const fetched = res.data.activities || [];
        setActivities((prev) => {
          const merged = new Map(prev.map((a) => [a.id, a]));
          fetched.forEach((a) => merged.set(a.id, a));
          return Array.from(merged.values());
        });
      } catch (err) {
        console.error("Failed to load activities for map:", err);
      }
    }, 400);
  }, []);

  // Fetch active SOS signals for visible bounds
  const fetchSosForBounds = useCallback(async (map) => {
    const c = map.getCenter();
    const radius = getRadiusFromBounds(map);
    try {
      const res = await sosAPI.getActive({ lat: c.lat(), lng: c.lng(), radius });
      setSosSignals(res.data.signals || []);
    } catch (err) {
      console.error("Failed to load SOS signals:", err);
    }
  }, []);

  const handleRemoveOwnSos = useCallback(async (signalId) => {
    if (!signalId || sosActionId) return;
    if (!window.confirm("Remove this SOS signal from map?")) return;

    setSosActionId(signalId);
    try {
      await sosAPI.deleteById(signalId);
      setSosSignals((prev) => prev.filter((s) => s.id !== signalId));
      infoWindowRef.current?.close();
    } catch (err) {
      console.error("Failed to remove SOS signal:", err);
      alert("Failed to remove SOS signal. Please try again.");
    } finally {
      setSosActionId(null);
    }
  }, [sosActionId]);

  // Search: fetch Google Places suggestions
  const fetchSuggestions = useCallback((query) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
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

  // Navigate map to a selected place
  const selectSuggestion = useCallback(async (suggestion) => {
    setSearchQuery(suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
    if (!window.google?.maps?.places?.Place) return;
    try {
      const place = new google.maps.places.Place({ id: suggestion.placeId });
      await place.fetchFields({ fields: ["location"] });
      const lat = place.location.lat();
      const lng = place.location.lng();
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(15);
      }
    } catch (err) {
      console.error("Place details error:", err);
    }
  }, []);

  const handleSearchKeyDown = (e) => {
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

  // Close suggestions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep SOS markers updated in real-time via socket events.
  useEffect(() => {
    const socket = getSocket();

    const handleSosSignal = (signal) => {
      setSosSignals((prev) => {
        const rest = prev.filter((s) => s.id !== signal.id);
        return [signal, ...rest];
      });
    };

    const handleSosResolved = ({ signalId, userId }) => {
      setSosSignals((prev) =>
        prev.filter((s) => {
          if (signalId) return s.id !== signalId;
          return s.user?.id !== userId;
        }),
      );
    };

    socket.on("sos-signal", handleSosSignal);
    socket.on("sos-resolved", handleSosResolved);

    return () => {
      socket.off("sos-signal", handleSosSignal);
      socket.off("sos-resolved", handleSosResolved);
    };
  }, []);

  // Init Google Map when center is ready
  useEffect(() => {
    if (!center) return; // waiting for geolocation on first visit
    if (!mapDivRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then(() => {
      if (cancelled) return;
      const maps = window.google.maps;

      const map = new maps.Map(mapDivRef.current, {
        center,
        zoom: 14,
        mapId: "synco-main-map",
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
      });
      mapRef.current = map;

      // Shared InfoWindow
      infoWindowRef.current = new maps.InfoWindow();

      // User location marker (blue dot)
      const userDot = document.createElement("div");
      userDot.innerHTML = `<div style="width:18px;height:18px;background:#2b5a8e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(43,90,142,0.5);"></div>`;
      userMarkerRef.current = new maps.marker.AdvancedMarkerElement({
        map,
        position: center,
        content: userDot,
        zIndex: 1000,
      });

      // MarkerClusterer with SuperCluster for performance
      clustererRef.current = new MarkerClusterer({
        map,
        markers: [],
        algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 16 }),
        renderer: {
          render: ({ count, position }) => {
            const el = document.createElement("div");
            el.className = "cluster-marker";
            el.textContent = count;
            return new maps.marker.AdvancedMarkerElement({
              position,
              content: el,
            });
          },
        },
      });

      // Fetch on idle (after pan/zoom)
      map.addListener("idle", () => {
        fetchForBounds(map);
        fetchSosForBounds(map);
      });
    });

    return () => { cancelled = true; };
  }, [center, fetchForBounds, fetchSosForBounds]);

  // Sync activity markers with clusterer
  useEffect(() => {
    if (!mapRef.current || !clustererRef.current) return;
    const maps = window.google.maps;
    const existing = markersRef.current;
    const newIds = new Set(activities.map((a) => a.id));

    // Remove markers no longer in activities
    for (const [id, marker] of existing) {
      if (!newIds.has(id)) {
        marker.map = null;
        existing.delete(id);
      }
    }

    // Add new markers
    const newMarkers = [];
    for (const act of activities) {
      if (existing.has(act.id)) continue;
      const content = createCategoryMarkerElement(act.category);
      const marker = new maps.marker.AdvancedMarkerElement({
        position: { lat: act.latitude, lng: act.longitude },
        content,
        title: act.title,
      });

      // Click → InfoWindow
      marker.addListener("click", () => {
        const iw = infoWindowRef.current;
        iw.setContent(`
          <div style="text-align:center;min-width:160px;max-width:220px;font-family:Inter,sans-serif;">
            <h4 style="margin:0 0 4px;font-size:14px;color:#111;font-weight:700;">${act.title}</h4>
            <div style="font-size:11px;color:#666;margin-bottom:4px;">${act.address || ""}</div>
            <div style="font-size:11px;color:#999;margin-bottom:10px;">
              ${new Date(act.date).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              · ${act._count?.members || 0}/${act.maxParticipants} joined
            </div>
            <button onclick="window.__syncoNav__('${act.id}')" style="
              width:100%;padding:8px;
              background:linear-gradient(135deg,#1a3c63 0%,#2b5a8e 100%);
              color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;
            ">View Activity</button>
          </div>
        `);
        iw.open({ map: mapRef.current, anchor: marker });
      });

      existing.set(act.id, marker);
      newMarkers.push(marker);
    }

    // Update clusterer
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(Array.from(existing.values()));

    setActivityCount(existing.size);
  }, [activities]);

  // Sync SOS markers
  useEffect(() => {
    if (!mapRef.current) return;
    const maps = window.google.maps;
    const existing = sosMarkersRef.current;
    const newIds = new Set(sosSignals.map((s) => s.id));

    // Remove stale SOS markers
    for (const [id, marker] of existing) {
      if (!newIds.has(id)) {
        marker.map = null;
        existing.delete(id);
      }
    }

    // Add new SOS markers
    for (const signal of sosSignals) {
      if (existing.has(signal.id)) continue;
      const pos = { lat: signal.latitude, lng: signal.longitude };

      // SOS marker DOM element
      const el = document.createElement("div");
      el.className = "sos-marker";
      el.innerHTML = `
        <div class="sos-pulse-ring"></div>
        <div class="sos-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 9v4"/><path d="M12 17h.01"/>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
        </div>
      `;

      const marker = new maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: pos,
        content: el,
        zIndex: 2000,
      });

      // Click behavior: always show SOS info popup; actions differ by owner/non-owner.
      marker.addListener("click", () => {
        const iw = infoWindowRef.current;
        const time = new Date(signal.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const isOwner = signal.user?.id === user?.id;

        iw.setContent(`
          <div style="text-align:center;min-width:140px;font-family:Inter,sans-serif;">
            <h4 style="margin:0 0 4px;font-size:14px;color:#e53e3e;font-weight:700;">🚨 SOS Signal</h4>
            <div style="font-size:12px;color:#666;margin-bottom:2px;">${signal.user?.displayName || "Someone"} needs help</div>
            <div style="font-size:11px;color:#999;margin-bottom:10px;">${time}</div>
            ${isOwner ? `
              <button onclick="window.__syncoRemoveSos__('${signal.id}')" style="
                width:100%;padding:8px;
                background:#e53e3e;
                color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;
              ">${sosActionId === signal.id ? "Removing..." : "Remove SOS"}</button>
            ` : `
              <button onclick="window.__syncoVisitSos__('${signal.latitude}','${signal.longitude}')" style="
                width:100%;padding:8px;
                background:#2f855a;
                color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;
              ">Visit</button>
            `}
          </div>
        `);
        iw.open({ map: mapRef.current, anchor: marker });
      });

      existing.set(signal.id, marker);
    }
  }, [sosSignals]);

  // Navigation helper for InfoWindow buttons
  useEffect(() => {
    window.__syncoNav__ = (id) => navigate(`/activities/${id}`);
    window.__syncoRemoveSos__ = (id) => { handleRemoveOwnSos(id); };
    window.__syncoVisitSos__ = (lat, lng) => {
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      window.open(mapsUrl, "_blank", "noopener,noreferrer");
    };
    return () => {
      delete window.__syncoNav__;
      delete window.__syncoRemoveSos__;
      delete window.__syncoVisitSos__;
    };
  }, [navigate, handleRemoveOwnSos]);

  if (!center) {
    return (
      <div
        className="page-content"
        style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}
      >
        <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }}></span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "calc(100vh - var(--nav-height) - var(--bottom-nav-height))",
        width: "100%",
        position: "relative",
      }}
    >
      {/* Search bar */}
      <div
        ref={searchWrapperRef}
        style={{
          position: "absolute",
          top: "var(--space-3)",
          left: "var(--space-3)",
          right: "var(--space-3)",
          zIndex: 1001,
          maxWidth: 420,
        }}
      >
        <div style={{ position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--color-text-muted)", pointerEvents: "none", zIndex: 1,
            }}
          />
          <input
            type="text"
            placeholder="Search places on map..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              fetchSuggestions(e.target.value);
            }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoComplete="off"
            style={{
              width: "100%",
              padding: "10px 36px 10px 36px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-full)",
              background: "var(--color-surface)",
              fontSize: "var(--text-sm)",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              outline: "none",
            }}
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

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 1002,
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
                  background: i === selectedIdx ? "rgba(43,90,142,0.08)" : "transparent",
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

      {/* Activity count badge */}
      {!loading && (
        <div
          style={{
            position: "absolute",
            top: 56,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-full)",
            padding: "var(--space-2) var(--space-4)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-primary)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            pointerEvents: "none",
          }}
        >
          {activityCount} activit{activityCount !== 1 ? "ies" : "y"} nearby
        </div>
      )}

      <div
        ref={mapDivRef}
        style={{ height: "100%", width: "100%", background: "#e8e8e8" }}
      />
    </div>
  );
};

export default MapPage;
