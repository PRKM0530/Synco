import { useState, useEffect, useRef } from "react";
import { getSocket } from "../../services/socket";
import { chatAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { MessageSquare, Pin, MoreVertical, Trash2 } from "lucide-react";

const ChatRoom = ({ activityId, isHost }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [lastReadAt, setLastReadAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await chatAPI.getActivityMessages(activityId);
        setMessages(res.data.messages || []);
        setLastReadAt(
          res.data.lastReadAt ? new Date(res.data.lastReadAt) : new Date(0),
        );

        // Mark read silently after loading history
        chatAPI.markChatRead(activityId).catch(console.error);
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    const socket = getSocket();

    // Join room
    socket.emit("join-activity-room", activityId);

    // Listen for incoming messages
    socket.on("receive-activity-message", (message) => {
      setMessages((prev) => [...prev, message]);
      // Silently update read status if currently looking at it
      chatAPI.markChatRead(activityId).catch(console.error);
    });

    // Listen for message deletion/pinning updates
    socket.on("message-deleted", (deletedMessage) => {
      if (!deletedMessage?.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === deletedMessage.id ? { ...m, ...deletedMessage } : m)),
      );
    });

    socket.on("message-pinned", ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m)),
      );
    });

    return () => {
      socket.emit("leave-activity-room", activityId);
      socket.off("receive-activity-message");
      socket.off("message-deleted");
      socket.off("message-pinned");
    };
  }, [activityId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const socket = getSocket();
    socket.emit("send-activity-message", {
      activityId,
      content: newMessage.trim(),
    });

    setNewMessage("");
  };

  const togglePin = async (msgId) => {
    try {
      const res = await chatAPI.pinMessage(msgId);
      const isPinned = res.data.isPinned;
      // Emit to room so everyone updates instantly
      const socket = getSocket();
      socket.emit("pin-activity-message", {
        activityId,
        messageId: msgId,
        isPinned,
      });
    } catch (err) {
      alert(err.response?.data?.error || "Failed to pin message.");
    }
  };

  const deleteMessage = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const res = await chatAPI.deleteMessage(msgId);
      const deletedMessage = res.data?.deletedMessage;
      // Emit to room so everyone updates instantly
      const socket = getSocket();
      socket.emit("delete-activity-message", { activityId, deletedMessage });
      setOpenMenuId(null);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete message.");
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "var(--space-4)",
        }}
      >
        <span className="spinner" style={{ width: 24, height: 24 }}></span>
      </div>
    );
  }

  const pinnedMessages = messages.filter((m) => m.isPinned);
  return (
    <div
      className="chat-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "600px",
        padding: "0",
        overflow: "hidden",
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          background: "var(--color-surface-hover)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-base)",
            margin: 0,
            color: "var(--color-primary-light)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <MessageSquare size={18} /> Activity Chat
        </h3>
      </div>

      {pinnedMessages.length > 0 && (
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            background: "rgba(253, 203, 110, 0.1)",
            borderBottom: "1px solid rgba(253, 203, 110, 0.3)",
            maxHeight: "60px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "#FDCB6E",
              marginBottom: "2px",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <Pin size={12} /> Pinned
          </div>
          {pinnedMessages.map((pm) => (
            <div
              key={`pin-${pm.id}`}
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {pm.sender.displayName}: {pm.content}
            </div>
          ))}
        </div>
      )}

      <div
        className="chat-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--color-text-muted)",
              margin: "auto 0",
            }}
          >
            No messages yet. Say hi!
          </div>
        ) : (
          (() => {
            const firstUnreadIndex = messages.findIndex(
              (m) =>
                m.sender.id !== user.id &&
                lastReadAt &&
                new Date(m.createdAt) > lastReadAt,
            );
            const unreadCount = messages.filter(
              (m) =>
                m.sender.id !== user.id &&
                lastReadAt &&
                new Date(m.createdAt) > lastReadAt,
            ).length;

            return messages.map((msg, index) => {
              const isMe = msg.sender.id === user.id;
              const messageTime = new Date(msg.createdAt);
              const canDelete = isHost || isMe;
              const canPin = isHost && msg.type !== "SYSTEM";
              const canShowMenu = canDelete || canPin;
              const isDeletedMessage = msg.type === "SYSTEM";

              return (
                <div
                  key={msg.id || index}
                  style={{ display: "flex", flexDirection: "column" }}
                >
                  {index === firstUnreadIndex && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        margin: "var(--space-4) 0",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          borderTop: "1px dashed var(--color-primary)",
                        }}
                      ></div>
                      <span
                        style={{
                          padding: "0 var(--space-3)",
                          color: "var(--color-primary)",
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        Unread Messages ({unreadCount})
                      </span>
                      <div
                        style={{
                          flex: 1,
                          borderTop: "1px dashed var(--color-primary)",
                        }}
                      ></div>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start",
                      marginTop:
                        index === firstUnreadIndex ? "var(--space-3)" : "0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "var(--space-2)",
                        flexDirection: isMe ? "row-reverse" : "row",
                      }}
                    >
                      <div
                        className="avatar avatar--sm"
                        style={{
                          border: `1px solid ${isMe ? "var(--color-primary)" : "var(--color-border)"}`,
                        }}
                      >
                        {msg.sender.profilePhoto ? (
                          <img
                            src={msg.sender.profilePhoto}
                            alt={msg.sender.displayName}
                          />
                        ) : (
                          msg.sender.displayName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isMe ? "flex-end" : "flex-start",
                          maxWidth: "80%",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                          }}
                        >
                          <div
                            style={{
                              background: isMe
                                ? "var(--color-primary)"
                                : "var(--color-surface-hover)",
                              color: isMe ? "#fff" : "var(--color-text)",
                              padding: "var(--space-2) var(--space-3)",
                              borderRadius: "var(--radius-lg)",
                              borderBottomRightRadius: isMe
                                ? "2px"
                                : "var(--radius-lg)",
                              borderBottomLeftRadius: isMe
                                ? "var(--radius-lg)"
                                : "2px",
                              wordBreak: "break-word",
                              fontSize: "var(--text-sm)",
                              border: msg.isPinned
                                ? "1px solid #FDCB6E"
                                : "none",
                              fontStyle: isDeletedMessage ? "italic" : "normal",
                              opacity: isDeletedMessage ? 0.85 : 1,
                            }}
                          >
                            {msg.isPinned && (
                              <Pin
                                size={12}
                                style={{ marginRight: 6, verticalAlign: "text-bottom", color: "#FDCB6E" }}
                                title="Pinned message"
                              />
                            )}
                            {msg.content}
                          </div>

                          {canShowMenu && (
                            <div
                              style={{ display: "flex", gap: "var(--space-1)", position: "relative" }}
                            >
                              <button
                                onClick={() => setOpenMenuId((prev) => (prev === msg.id ? null : msg.id))}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  opacity: 0.6,
                                  padding: 0,
                                }}
                                title="Message actions"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {openMenuId === msg.id && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "18px",
                                    right: isMe ? "0" : "auto",
                                    left: isMe ? "auto" : "0",
                                    minWidth: "130px",
                                    background: "var(--color-surface)",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: "8px",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                                    zIndex: 10,
                                    overflow: "hidden",
                                  }}
                                >
                                  {canPin && (
                                    <button
                                      onClick={() => {
                                        togglePin(msg.id);
                                        setOpenMenuId(null);
                                      }}
                                      style={{
                                        width: "100%",
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--color-text)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                      }}
                                    >
                                      <Pin size={13} /> {msg.isPinned ? "Unpin Message" : "Pin Message"}
                                    </button>
                                  )}
                                  {canDelete && !isDeletedMessage && (
                                    <button
                                      onClick={() => deleteMessage(msg.id)}
                                      style={{
                                        width: "100%",
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--color-danger)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                      }}
                                    >
                                      <Trash2 size={13} /> Delete Message
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "var(--color-text-muted)",
                            marginTop: "4px",
                            alignSelf: isMe ? "flex-end" : "flex-start",
                          }}
                        >
                          {msg.sender.displayName} •{" "}
                          {messageTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        style={{
          display: "flex",
          padding: "var(--space-2)",
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <input
          type="text"
          className="input"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            boxShadow: "none",
          }}
        />
        <button
          type="submit"
          className="btn btn--primary"
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-full)",
          }}
          disabled={!newMessage.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatRoom;
