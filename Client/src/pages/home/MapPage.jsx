import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { activityAPI } from "../../services/api";
import { getCategoryMarkerIcon } from "../../utils/categoryMarkers";

const userIcon = new L.DivIcon({
  className: "user-location-marker",
  html: `<div style="width:18px;height:18px;background:#2b5a8e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(43,90,142,0.5);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Calculate radius in km from map bounds
const getRadiusFromBounds = (map) => {
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  const ne = bounds.getNorthEast();
  const dist = center.distanceTo(ne); // metres
  return Math.ceil(dist / 1000); // km
};

// Fetches activities when map moves/zooms, debounced
const MapBoundsWatcher = ({ onBoundsChange }) => {
  const map = useMap();
  const timerRef = useRef(null);

  const handleChange = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const center = map.getCenter();
      const radius = getRadiusFromBounds(map);
      onBoundsChange({ lat: center.lat, lng: center.lng, radius });
    }, 400);
  }, [map, onBoundsChange]);

  useMapEvents({
    moveend: handleChange,
    zoomend: handleChange,
  });

  // Fire on first mount
  useEffect(() => {
    handleChange();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return null;
};

const MapPage = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);
  const seenIdsRef = useRef(new Set());

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
          setLoading(false);
        },
        () => {
          setCenter([28.6139, 77.209]);
          setLoading(false);
        },
      );
    } else {
      setCenter([28.6139, 77.209]);
      setLoading(false);
    }
  }, []);

  const handleBoundsChange = useCallback(async ({ lat, lng, radius }) => {
    try {
      const res = await activityAPI.getActivities({ lat, lng, radius });
      const fetched = res.data.activities || [];
      // Merge: keep existing + add new ones (avoids flicker)
      setActivities((prev) => {
        const merged = new Map(prev.map((a) => [a.id, a]));
        fetched.forEach((a) => merged.set(a.id, a));
        return Array.from(merged.values());
      });
    } catch (err) {
      console.error("Failed to load activities for map:", err);
    }
  }, []);

  if (!center && loading) {
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
      {/* Activity count badge */}
      {!loading && (
        <div
          style={{
            position: "absolute",
            top: "var(--space-4)",
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
          {activities.length} activit{activities.length !== 1 ? "ies" : "y"} nearby
        </div>
      )}

      {center && (
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapBoundsWatcher onBoundsChange={handleBoundsChange} />

          {/* User location */}
          <Marker position={center} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
          <Circle
            center={center}
            radius={300}
            pathOptions={{ color: "#2b5a8e", fillColor: "#2b5a8e", fillOpacity: 0.1, weight: 1 }}
          />

          {/* Activity markers */}
          {activities.map((act) => (
            <Marker key={act.id} position={[act.latitude, act.longitude]} icon={getCategoryMarkerIcon(act.category)}>
              <Popup>
                <div style={{ textAlign: "center", minWidth: "160px", maxWidth: "220px" }}>
                  <h4 style={{ margin: "0 0 4px", fontSize: "14px", color: "#111", fontWeight: 700 }}>
                    {act.title}
                  </h4>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>
                    {act.address}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999", marginBottom: "10px" }}>
                    {new Date(act.date).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {act._count?.members || 0}/{act.maxParticipants} joined
                  </div>
                  <button
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "linear-gradient(135deg, #1a3c63 0%, #2b5a8e 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                    onClick={() => navigate(`/activities/${act.id}`)}
                  >
                    View Activity
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
};

export default MapPage;
