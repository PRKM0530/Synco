import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { chatAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const ChatInboxPage = ({ isEmbedded = false }) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await chatAPI.getInbox();
        const sortedChats = res.data.inbox.sort((a, b) => {
          if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
          if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
          return (
            new Date(b.lastMessage.createdAt) -
            new Date(a.lastMessage.createdAt)
          );
        });
        setChats(sortedChats);
      } catch (error) {
        console.error("Failed to load inbox:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, []);

  const getInitials = (name) => name?.charAt(0).toUpperCase() || "?";

  return (
    <div
      className={
        isEmbedded ? "animate-fade-in" : "page-content animate-fade-in"
      }
    >
      {!isEmbedded && (
        <div
          className="page-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1 className="page-title">Messages</h1>
        </div>
      )}

      <div style={{ marginBottom: "var(--space-6)" }}>

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "var(--space-8)",
            }}
          >
            <span className="spinner"></span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            {chats.length === 0 ? (
              <div className="empty-state card">
                <div className="empty-state-icon">📭</div>
                <h3 className="empty-state-title">No messages yet</h3>
                <p className="empty-state-text">
                  Go to a user's profile to start sending direct messages!
                </p>
                <button
                  className="btn btn--primary"
                  style={{ marginTop: "var(--space-4)" }}
                  onClick={() =>
                    navigate(isEmbedded ? "/friends?tab=friends" : "/map")
                  }
                >
                  {isEmbedded ? "Go to Friends" : "Discover Users"}
                </button>
              </div>
            ) : (
              chats.map((chat) => {
                const { type, friend, activity, lastMessage, unreadCount } =
                  chat;
                const displayName =
                  type === "dm" ? friend.displayName : activity.title;
                const displayPhoto =
                  type === "dm" ? friend.profilePhoto : activity.image;
                const label = type === "activity" ? "Group Chat" : "";

                return (
                  <Link
                    key={
                      type === "dm" ? `dm-${friend.id}` : `act-${activity.id}`
                    }
                    to={
                      type === "dm"
                        ? `/chat/${friend.id}`
                        : `/activities/${activity.id}#chat`
                    }
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div
                      className="card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "var(--space-4)",
                        gap: "var(--space-4)",
                        transition: "background 0.2s",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        className="avatar avatar--md"
                        style={
                          type === "activity"
                            ? { borderRadius: "var(--radius-md)" }
                            : {}
                        }
                      >
                        {displayPhoto ? (
                          <img src={displayPhoto} alt={displayName} />
                        ) : (
                          getInitials(displayName)
                        )}
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "var(--text-base)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-2)",
                            }}
                          >
                            {displayName}
                            {label && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  background: "var(--color-surface-hover)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  color: "var(--color-primary-light)",
                                }}
                              >
                                {label}
                              </span>
                            )}
                            {unreadCount > 0 && (
                              <span
                                style={{
                                  background: "#e74c3c",
                                  color: "#fff",
                                  borderRadius: "var(--radius-full)",
                                  padding: "2px 8px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  flexShrink: 0,
                                }}
                              >
                                {unreadCount} NEW
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--text-xs)",
                              color:
                                unreadCount > 0
                                  ? "var(--color-primary-light)"
                                  : "var(--color-text-muted)",
                            }}
                          >
                            {new Date(lastMessage.createdAt).toLocaleDateString(
                              [],
                              { month: "short", day: "numeric" },
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "var(--text-sm)",
                            color:
                              unreadCount > 0
                                ? "var(--color-text)"
                                : "var(--color-text-muted)",
                            marginTop: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "200px",
                              fontWeight: unreadCount > 0 ? 600 : 400,
                            }}
                          >
                            {lastMessage.senderId === user?.id
                              ? "You: "
                              : type === "activity"
                                ? `${lastMessage.sender.displayName}: `
                                : ""}
                            {lastMessage.content}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInboxPage;
