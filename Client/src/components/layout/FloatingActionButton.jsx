import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, Plus, MapPin } from "lucide-react";

const FAB_ACTIONS = [
  { id: "create", icon: <Plus size={22} />, label: "Create Activity", path: "/activities/create" },
  { id: "map", icon: <MapPin size={22} />, label: "Map View", path: "/map" },
];

const FloatingActionButton = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on auth pages
  if (["/login", "/register"].includes(location.pathname)) return null;

  const handleAction = (path) => {
    setOpen(false);
    navigate(path);
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
          {FAB_ACTIONS.map((action, i) => (
            <button
              key={action.id}
              className="fab-action-btn"
              onClick={() => handleAction(action.path)}
              title={action.label}
              style={{ transitionDelay: open ? `${i * 60}ms` : "0ms" }}
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
