import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Users, MessageCircle, User } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", icon: <Home size={20} />, label: "Home" },
  { path: "/explore", icon: <Compass size={20} />, label: "Explore" },
  { path: "/friends", icon: <Users size={20} />, label: "Friends" },
  { path: "/chat", icon: <MessageCircle size={20} />, label: "Chat" },
  { path: "/profile", icon: <User size={20} />, label: "Profile" },
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
