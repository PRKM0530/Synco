import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { friendAPI, userAPI } from "../../services/api";
import ChatInboxPage from "../chat/ChatInboxPage";
import { Users } from "lucide-react";

const FriendsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("friends"); // 'friends', 'chats'
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add friend state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParams = urlParams.get("tab");
    if (tabParams) {
      setActiveTab(tabParams);
    }
  }, []);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const res = await friendAPI.getFriends();
      setFriends(res.data.friends);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "friends") {
      fetchFriends();
    }
  }, [activeTab]);

  const handleRemoveFriend = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this friend?")) return;
    try {
      await friendAPI.removeFriend(userId);
      setFriends((prev) => prev.filter((f) => f.id !== userId));
    } catch (err) {
      alert("Failed to remove friend.");
    }
  };

  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await userAPI.searchUsers(searchQuery);
      setSearchResults(res.data.users);
    } catch (err) {
      console.error(err);
      alert("Failed to search users.");
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      await friendAPI.addFriend(userId);
      alert("Friend added successfully!");
      setSearchQuery("");
      setSearchResults([]);
      fetchFriends();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add friend.");
    }
  };

  const getInitials = (name) => name?.charAt(0).toUpperCase() || "?";

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
        <h1 className="page-title">Connect</h1>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          marginBottom: "var(--space-6)",
          overflowX: "auto",
          paddingBottom: "var(--space-2)",
        }}
      >
        <button
          className={`tag ${activeTab === "friends" ? "tag--active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          Friends ({friends?.length || 0})
        </button>
        <button
          className={`tag ${activeTab === "chats" ? "tag--active" : ""}`}
          onClick={() => setActiveTab("chats")}
        >
          Chats
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span className="spinner"></span>
        </div>
      ) : (
        <>
          {activeTab === "friends" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Search Bar */}
              <form onSubmit={handleSearchUsers} style={{ display: "flex", gap: "var(--space-2)" }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn--primary" disabled={searching}>
                  {searching ? "..." : "Search"}
                </button>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="card" style={{ padding: "var(--space-4)" }}>
                  <h3 style={{ marginBottom: "var(--space-3)", fontSize: "var(--text-base)" }}>Search Results</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {searchResults.map((user) => (
                       <div key={user.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }} onClick={() => navigate(`/profile/${user.id}`)}>
                            <div className="avatar avatar--sm" style={{ cursor: "pointer" }}>
                              {user.profilePhoto ? <img src={user.profilePhoto} alt={user.displayName} /> : getInitials(user.displayName)}
                            </div>
                            <div style={{ cursor: "pointer" }}>
                              <div style={{ fontWeight: 600 }}>{user.displayName}</div>
                            </div>
                          </div>
                          {!friends.some(f => f.id === user.id) ? (
                            <button className="btn btn--sm btn--primary" onClick={() => handleAddFriend(user.id)}>
                              Add
                            </button>
                          ) : (
                            <span className="badge badge--success">Friend</span>
                          )}
                       </div>
                    ))}
                  </div>
                </div>
              )}

              {friends.length === 0 ? (
                <div className="empty-state" style={{ marginTop: "var(--space-4)" }}>
                  <div className="empty-state-icon" style={{display: "flex", justifyContent: "center"}}>
                    <Users size={48} className="text-secondary" />
                  </div>
                  <h3 className="empty-state-title">No friends yet</h3>
                  <p className="empty-state-text">
                    Search above or add friends to see them here!
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: "var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {friends.map((user) => (
                    <div
                      key={user.id}
                      className="card"
                      onClick={() => navigate(`/profile/${user.id}`)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "var(--space-4)",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-4)",
                        }}
                      >
                        <div className="avatar avatar--md">
                          {user.profilePhoto ? (
                            <img src={user.profilePhoto} alt={user.displayName} />
                          ) : (
                            getInitials(user.displayName)
                          )}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "var(--text-base)",
                              fontWeight: 600,
                            }}
                          >
                            {user.displayName}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            Trust Score: {user.trustScore}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn--sm"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--color-danger)",
                          color: "var(--color-danger)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFriend(user.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "chats" && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <ChatInboxPage isEmbedded={true} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FriendsPage;
