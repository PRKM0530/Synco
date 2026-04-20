import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, Plus, MapPin, AlertTriangle } from "lucide-react";
import { sosAPI } from "../../services/api";

const FAB_ACTIONS = [
  { id: "create", icon: <Plus size={22} />, label: "Create Activity", path: "/activities/create" },
  { id: "map", icon: <MapPin size={22} />, label: "Map View", path: "/map" },
];

const FloatingActionButton = () => {
  const [open, setOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on auth pages
  if (["/login", "/register"].includes(location.pathname)) return null;

  const handleAction = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleSos = () => {
    if (sosSending) return;
    setSosSending(true);
    if (!navigator.geolocation) {
      alert("Geolocation not available on this device.");
      setSosSending(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await sosAPI.create({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          const notifiedCount = res.data?.notifiedCount || 0;
          setOpen(false);
          alert(`🚨 SOS sent. ${notifiedCount} nearby user${notifiedCount === 1 ? "" : "s"} notified.`);
        } catch (err) {
          console.error("SOS error:", err);
          alert("Failed to send SOS. Please try again.");
        }
        setSosSending(false);
      },
      () => {
        alert("Could not get your location. Please enable location access.");
        setSosSending(false);
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fab-backdrop"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fab-container">
        {/* Secondary action buttons */}
        <div className={`fab-actions ${open ? "fab-actions--open" : ""}`}>
          {/* SOS button */}
          <button
            className="fab-action-btn fab-action-sos"
            onClick={handleSos}
            title="Send SOS"
            disabled={sosSending}
            style={{ transitionDelay: open ? "0ms" : "0ms" }}
          >
            <span className="fab-action-icon fab-sos-icon">
              <AlertTriangle size={22} />
            </span>
            <span className="fab-action-label">{sosSending ? "Sending..." : "SOS"}</span>
          </button>
          {FAB_ACTIONS.map((action, i) => (
            <button
              key={action.id}
              className="fab-action-btn"
              onClick={() => handleAction(action.path)}
              title={action.label}
              style={{ transitionDelay: open ? `${(i + 1) * 60}ms` : "0ms" }}
            >
              <span className="fab-action-icon">{action.icon}</span>
              <span className="fab-action-label">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Main FAB */}
        <button
          className={`fab-main ${open ? "fab-main--open" : ""}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <ChevronDown size={26} className="fab-chevron" />
        </button>
      </div>
    </>
  );
};

export default FloatingActionButton;
