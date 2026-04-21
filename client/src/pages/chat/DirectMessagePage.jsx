import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { userAPI, chatAPI } from "../../services/api";
import { getSocket } from "../../services/socket";
import { useAuth } from "../../context/AuthContext";
import { Pin, MoreVertical, Trash2 } from "lucide-react";

const DirectMessagePage = () => {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [firstUnreadMsgId, setFirstUnreadMsgId] = useState(null);
  const [initialUnreadCount, setInitialUnreadCount] = useState(0);
  const [openMenuId, setOpenMenuId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Reset state when entering a new chat
    setFirstUnreadMsgId(null);
    setInitialUnreadCount(0);
    setMessages([]);

    const fetchContext = async () => {
      try {
        // Fetch friend details
        const friendRes = await userAPI.getProfile(friendId);
        setFriend(friendRes.data.user);

        // Fetch DM history
        const chatRes = await chatAPI.getDirectMessages(friendId);
        setMessages(chatRes.data);

        // Mark them as read if there are unread messages from them
        const unreadMsgs = chatRes.data.filter(
          (m) => !m.isRead && m.senderId === friendId,
        );
        if (unreadMsgs.length > 0) {
          setFirstUnreadMsgId((prev) => prev || unreadMsgs[0].id);
          setInitialUnreadCount((prev) => prev || unreadMsgs.length);
          // Small delay to prevent React StrictMode DB race conditions
          setTimeout(
            () => chatAPI.markDMRead(friendId).catch(console.error),
            2000,
          );
        }
      } catch (err) {
        console.error("Failed to load DM context:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchContext();

    const socket = getSocket();

    // Join DM room
    socket.emit("join-dm-room", friendId);

    // Listen for incoming messages
    socket.on("receive-dm-message", (message) => {
      // Mark as read in local state since we're viewing it
      setMessages((prev) => [...prev, { ...message, isRead: true }]);
      // Ping backend to mark this new drop-in as read
      chatAPI.markDMRead(friendId).catch(console.error);
    });

    socket.on("dm-message-deleted", (deletedMessage) => {
      if (!deletedMessage?.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === deletedMessage.id ? { ...m, ...deletedMessage } : m)),
      );
    });

    socket.on("dm-message-pinned", ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m)),
      );
    });

    return () => {
      socket.emit("leave-dm-room", friendId);
      socket.off("receive-dm-message");
      socket.off("dm-message-deleted");
      socket.off("dm-message-pinned");
    };
  }, [friendId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const socket = getSocket();
    socket.emit("send-dm-message", {
      receiveId: friendId, // Matches expected key in socket.js
      content: newMessage.trim(),
    });

    setNewMessage("");
  };

  const togglePin = async (msgId) => {
    try {
      const res = await chatAPI.pinDMMessage(msgId);
      const isPinned = res.data.isPinned;
      const socket = getSocket();
      socket.emit("pin-dm-message", {
        receiveId: friendId,
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
      const res = await chatAPI.deleteDMMessage(msgId);
      const deletedMessage = res.data?.deletedMessage;
      const socket = getSocket();
      socket.emit("delete-dm-message", { receiveId: friendId, deletedMessage });
      setOpenMenuId(null);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete message.");
    }
  };

  if (loading) {
    return (
      <div
        className="page-content"
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "100px",
        }}
      >
        <span
          className="spinner"
          style={{ width: 40, height: 40, borderWidth: 4 }}
        ></span>
      </div>
    );
  }

  if (!friend) {
    return <div className="page-content empty-state">User not found.</div>;
  }

  let unreadDividerRendered = false;

  return (
    <div
      className="page-content animate-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - var(--bottom-nav-height))",
        paddingBottom: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "var(--space-4)",
        }}
      >
        <button
          className="btn btn--secondary"
          style={{ padding: "8px", border: "none", background: "transparent" }}
          onClick={() => navigate("/friends?tab=chats")}
        >
          ← Back
        </button>
        <div className="avatar avatar--sm">
          {friend.profilePhoto ? (
            <img src={friend.profilePhoto} alt={friend.displayName} />
          ) : (
            friend.displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div style={{ fontWeight: 600, fontSize: "var(--text-lg)" }}>
          {friend.displayName}
        </div>
      </div>

      {/* Pinned Messages Banner */}
      {(() => {
        const pinnedMessages = messages.filter((m) => m.isPinned);
        if (pinnedMessages.length === 0) return null;
        return (
          <div
            style={{
              padding: "var(--space-2) var(--space-4)",
              background: "rgba(253, 203, 110, 0.1)",
              borderBottom: "1px solid rgba(253, 203, 110, 0.3)",
              maxHeight: "60px",
              overflowY: "auto",
              flexShrink: 0,
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
        );
      })()}

      {/* Chat Messages Area */}
      <div
        className="chat-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: "var(--space-2)",
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
            No messages yet. Say hi to {friend.displayName}!
          </div>
        ) : (
          (() => {
            let firstUnreadIndex = -1;
            if (firstUnreadMsgId) {
              firstUnreadIndex = messages.findIndex(
                (m) => m.id === firstUnreadMsgId,
              );
            }
            const unreadCount = initialUnreadCount;

            return messages.map((msg, index) => {
              const isMe = msg.sender.id === user.id;

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
                        alignItems: "flex-end",
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
                              border: msg.isPinned ? "1px solid #FDCB6E" : "none",
                              fontStyle: msg.type === "SYSTEM" ? "italic" : "normal",
                              opacity: msg.type === "SYSTEM" ? 0.85 : 1,
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

                          {(isMe || msg.type !== "SYSTEM") && (
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
                                  {msg.type !== "SYSTEM" && (
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
                                  {isMe && msg.type !== "SYSTEM" && (
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
                          {new Date(msg.createdAt).toLocaleTimeString([], {
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

      {/* Input Area */}
      <div style={{ padding: "var(--space-4) 0" }}>
        <form
          onSubmit={handleSendMessage}
          style={{ display: "flex", gap: "var(--space-2)" }}
        >
          <input
            type="text"
            className="input"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn--primary"
            style={{
              padding: "0 var(--space-4)",
              borderRadius: "var(--radius-full)",
            }}
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default DirectMessagePage;
