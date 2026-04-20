import { useState, useEffect } from "react";
import { notificationAPI } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { Bell, Clock, CheckCircle, XCircle, Users, CalendarX, Mail, X, AlertTriangle, Ban } from "lucide-react";
import { getSocket } from "../../services/socket";

const getNotifIcon = (notif) => {
  const { type, title } = notif;
  
  // Specific overrides based on title for REMINDER type
  if (title?.includes("Platform Warning")) return <AlertTriangle size={22} color="#f39c12" />;
  if (title?.includes("Account Banned"))  return <Ban size={22} color="#e74c3c" />;

  switch (type) {
    case "JOIN_REQUEST":   return <Clock size={22} color="#f39c12" />;
    case "APPROVAL":       return <CheckCircle size={22} color="#2ecc71" />;
    case "REJECTION":      return <XCircle size={22} color="#e74c3c" />;
    case "FRIEND_REQUEST": return <Users size={22} color="#3498db" />;
    case "REMINDER":       return <Bell size={22} color="#9b59b6" />;
    case "CANCELLATION":   return <CalendarX size={22} color="#e74c3c" />;
    case "SOS_ALERT":      return <AlertTriangle size={22} color="#e53e3e" />;
    default:               return <Mail size={22} color="#636e72" />;
  }
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await notificationAPI.getNotifications();
        setNotifications(res.data.notifications);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();

    // Real-time notifications
    const socket = getSocket();
    const handleNew = (data) => {
      setNotifications((prev) => {
        const incomingId = data.id || Date.now().toString();
        if (prev.some((n) => n.id === incomingId)) return prev;
        return [
          {
            ...data,
            id: incomingId,
            createdAt: data.createdAt || new Date().toISOString(),
            isRead: false,
          },
          ...prev,
        ];
      });
    };
    socket.on("new-notification", handleNew);
    return () => socket.off("new-notification", handleNew);
  }, []);

  const handleReadClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationAPI.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
        );
      } catch (e) {
        console.error(e);
      }
    }

    if (
      notif.type === "JOIN_REQUEST" ||
      notif.type === "APPROVAL" ||
      notif.type === "REJECTION" ||
      notif.type === "REMINDER" ||
      notif.type === "CANCELLATION"
    ) {
      if (notif.activityId) navigate(`/activities/${notif.activityId}`);
    } else if (notif.type === "FRIEND_REQUEST") {
      navigate("/friends");
    } else if (notif.type === "SOS_ALERT") {
      navigate("/map");
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => notificationAPI.markAsRead(n.id)));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // don't trigger the read/navigate click
    try {
      await notificationAPI.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading)
    return (
      <div
        className="page-content"
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "100px",
        }}
      >
        <span className="spinner"></span>
      </div>
    );

  return (
    <div className="page-content animate-fade-in">
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Bell size={28} className="text-secondary" /> Notifications
        </h1>
        {unreadCount > 0 && (
          <button
            className="btn btn--secondary btn--sm"
            onClick={handleMarkAllRead}
          >
            Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1px",
          background: "var(--color-border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {notifications.length === 0 ? (
          <div
            className="empty-state"
            style={{ background: "var(--color-surface)", margin: 0 }}
          >
            <div className="empty-state-icon" style={{ display: "flex", justifyContent: "center" }}>
              <Bell size={48} className="text-secondary"/>
            </div>
            <h3 className="empty-state-title">All caught up!</h3>
            <p className="empty-state-text">You have no new notifications.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`card card--hover`}
              style={{
                margin: 0,
                borderRadius: 0,
                backgroundColor: notif.isRead
                  ? "var(--color-surface)"
                  : "rgba(108, 92, 231, 0.1)",
                borderLeft: notif.isRead
                  ? "4px solid transparent"
                  : "4px solid var(--color-primary)",
                cursor: "pointer",
                display: "flex",
                gap: "var(--space-4)",
                alignItems: "flex-start",
                position: "relative",
              }}
              onClick={() => handleReadClick(notif)}
            >
              <div style={{ marginTop: "2px", display: "flex", alignItems: "center" }}>
                {getNotifIcon(notif)}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: notif.isRead
                        ? "var(--color-text-secondary)"
                        : "var(--color-text-primary)",
                    }}
                  >
                    {notif.title}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {new Date(notif.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {notif.message}
                </p>
                {!notif.isRead && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--color-primary-light)",
                      fontWeight: 600,
                      marginTop: "var(--space-2)",
                      display: "block",
                    }}
                  >
                    Tap to view →
                  </span>
                )}
              </div>
              {/* Dismiss button */}
              <button
                onClick={(e) => handleDelete(e, notif.id)}
                title="Dismiss"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "50%",
                  transition: "background 0.15s, color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(231,76,60,0.12)"; e.currentTarget.style.color = "#e74c3c"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
              >
                <X size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
