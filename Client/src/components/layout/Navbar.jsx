import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SyncoLogo from "../common/SyncoLogo";
import { useEffect, useState, useRef } from "react";
import { notificationAPI } from "../../services/api";
import { Users, ShieldCheck, Bell, X, Compass } from "lucide-react";

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastQueue, setToastQueue] = useState([]); // [{id, title, message}]
  const prevUnreadRef = useRef(0);
  const latestNotifIdRef = useRef(null);

  // Poll for unread notification count every 30 seconds & show toasts on new ones
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      try {
        const res = await notificationAPI.getNotifications();
        const all = res.data.notifications || [];
        const unread = all.filter((n) => !n.isRead);
        const count = unread.length;
        setUnreadCount(count);

        // Show toast for newest unread notification if it's new
        if (unread.length > 0) {
          const newest = unread[0];
          if (newest.id !== latestNotifIdRef.current && prevUnreadRef.current !== null) {
            // Only show toast if this isn't the first load
            if (prevUnreadRef.current !== undefined && latestNotifIdRef.current !== null) {
              const toastId = Date.now();
              setToastQueue((prev) => [
                { id: toastId, title: newest.title, message: newest.message, notif: newest },
                ...prev.slice(0, 2), // max 3 toasts
              ]);
              // Auto-dismiss after 5s
              setTimeout(() => {
                setToastQueue((prev) => prev.filter((t) => t.id !== toastId));
              }, 5000);
            }
            latestNotifIdRef.current = newest.id;
          } else if (latestNotifIdRef.current === null) {
            latestNotifIdRef.current = newest.id;
          }
        }

        prevUnreadRef.current = count;
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Reset badge when visiting notifications page
  useEffect(() => {
    if (location.pathname === "/notifications") {
      setUnreadCount(0);
      setToastQueue([]);
    }
  }, [location.pathname]);

  // Don't show navbar on auth pages
  if (["/login", "/register"].includes(location.pathname)) return null;

  const getInitials = (name) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?"
    );
  };

  const dismissToast = (toastId) => {
    setToastQueue((prev) => prev.filter((t) => t.id !== toastId));
  };

  return (
    <>
      {/* Notification Toast Stack */}
      <div
        style={{
          position: "fixed",
          bottom: "80px",
          right: "16px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxWidth: "320px",
        }}
      >
        {toastQueue.map((toast) => (
          <div
            key={toast.id}
            onClick={() => {
              dismissToast(toast.id);
              navigate("/notifications");
            }}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-primary)",
              borderLeft: "4px solid var(--color-primary)",
              borderRadius: "var(--radius-lg)",
              padding: "12px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              cursor: "pointer",
              animation: "slideInRight 0.3s ease",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            <Bell size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                {toast.title}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {toast.message}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-text-muted)", flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <nav className="navbar" id="main-navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            <SyncoLogo size={36} className="navbar-logo" />
            <span className="navbar-title">Synco</span>
          </Link>

          <div className="navbar-actions" style={{ gap: "var(--space-3)" }}>
            {user ? (
              <>
                <Link
                  to="/explore"
                  className="navbar-icon-btn desktop-only"
                  title="Explore"
                >
                  <Compass size={20} className="text-secondary" />
                </Link>
                <Link
                  to="/friends"
                  className="navbar-icon-btn desktop-only"
                  title="Friends"
                >
                  <Users size={20} className="text-secondary" />
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    style={{
                      textDecoration: "none",
                      background: "rgba(0,0,0,0.05)",
                      padding: "6px 12px",
                      borderRadius: "var(--radius-full)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "#f39c12",
                      border: "1px solid #f39c1244",
                    }}
                    title="Admin Dashboard"
                  >
                    <ShieldCheck size={16} /> Admin
                  </Link>
                )}
                <Link
                  to="/notifications"
                  className="navbar-icon-btn"
                  style={{ position: "relative" }}
                  title="Notifications"
                >
                  <Bell size={20} className="text-secondary" />
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        background: "#e74c3c",
                        color: "#fff",
                        borderRadius: "50%",
                        fontSize: "10px",
                        fontWeight: 700,
                        minWidth: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid var(--color-bg)",
                        lineHeight: 1,
                      }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
                <Link to="/profile" className="navbar-avatar-btn desktop-only" title="Profile">
                  <div className="avatar avatar--sm">
                    {user.profilePhoto ? (
                      <img src={user.profilePhoto} alt={user.displayName} />
                    ) : (
                      getInitials(user.displayName)
                    )}
                  </div>
                </Link>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={logout}
                  id="logout-btn"
                  title="Sign out"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">
                  Sign In
                </Link>
                <Link to="/register" className="btn btn--primary btn--sm">
                  Join Synco
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
