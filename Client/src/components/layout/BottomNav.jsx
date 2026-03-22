import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", icon: "🏠", label: "Home" },
  { path: "/map", icon: "🗺️", label: "Map" },
  { path: "/friends", icon: "👥", label: "Friends" },
  { path: "/chat", icon: "💬", label: "Chat" },
  { path: "/profile", icon: "👤", label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();

  // Don't show on auth pages
  if (["/login", "/register"].includes(location.pathname)) return null;

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {NAV_ITEMS.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path !== "/" && location.pathname.startsWith(item.path));

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item ${isActive ? "active" : ""}`}
            id={`nav-${item.label.toLowerCase()}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
