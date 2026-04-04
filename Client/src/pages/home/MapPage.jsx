import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import CategoryIcon from "../../components/common/CategoryIcon";
import { activityAPI } from "../../services/api";

const LIBRARIES = ["places"];

const MapPage = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(loc);
          fetchActivities(loc);
        },
        () => {
          const defaultLoc = { lat: 28.6139, lng: 77.209 }; // Default to Delhi
          setCenter(defaultLoc);
          fetchActivities(defaultLoc);
        },
      );
    } else {
      const defaultLoc = { lat: 28.6139, lng: 77.209 };
      setCenter(defaultLoc);
      fetchActivities(defaultLoc);
    }
  }, []);

  const fetchActivities = async (loc) => {
    try {
      const res = await activityAPI.getActivities(
        loc ? { lat: loc.lat, lng: loc.lng, radius: 999999 } : {},
      );
      setActivities(res.data.activities || []);
    } catch (error) {
      console.error("Failed to load activities for map:", error);
    } finally {
      setLoading(false);
    }
  };

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

      {isLoaded && center && (
        <GoogleMap
          mapContainerStyle={{ height: "100%", width: "100%" }}
          center={center}
          zoom={12}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false, // Disable POI/landmark clicks
          }}
          onClick={() => setSelectedActivity(null)}
        >
          {/* User location marker */}
          <MarkerF
            position={center}
            icon={{
              path: "M 0 -10 C 5 -10 10 -5 10 0 C 10 5 5 10 0 10 C -5 10 -10 5 -10 0 C -10 -5 -5 -10 0 -10 Z",
              fillColor: "#2b5a8e",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 3,
              scale: 1,
            }}
            title="You are here"
          />

          {/* Activity markers */}
          {activities.map((act) => (
            <MarkerF
              key={act.id}
              position={{ lat: act.latitude, lng: act.longitude }}
              onClick={() => setSelectedActivity(act)}
            />
          ))}

          {/* InfoWindow for selected activity */}
          {selectedActivity && (
            <InfoWindowF
              position={{
                lat: selectedActivity.latitude,
                lng: selectedActivity.longitude,
              }}
              onCloseClick={() => setSelectedActivity(null)}
            >
              <div
                style={{
                  padding: "4px",
                  textAlign: "center",
                  minWidth: "160px",
                  maxWidth: "220px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "6px",
                    color: "var(--color-primary)",
                  }}
                >
                  <CategoryIcon category={selectedActivity.category} size={28} />
                </div>
                <h4 style={{ margin: "0 0 4px", fontSize: "14px", color: "#111", fontWeight: 700 }}>
                  {selectedActivity.title}
                </h4>
                <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>
                  {selectedActivity.address}
                </div>
                <div style={{ fontSize: "11px", color: "#999", marginBottom: "10px" }}>
                  {new Date(selectedActivity.date).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {selectedActivity._count?.members || 0}/{selectedActivity.maxParticipants} joined
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
                  onClick={() => navigate(`/activities/${selectedActivity.id}`)}
                >
                  View Activity
                </button>
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>
      )}
    </div>
  );
};

export default MapPage;
