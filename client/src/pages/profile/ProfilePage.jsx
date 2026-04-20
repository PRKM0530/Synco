import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { userAPI, friendAPI, reportAPI } from "../../services/api";
import { ShieldCheck, Handshake, AlertTriangle, Target, ClipboardList, CheckCircle, XCircle, Clock, Calendar, Pencil, MessageSquare, Flag } from "lucide-react";

const ProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

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

  const getTrustTier = (score) => {
    if (score >= 80) return { label: "Trusted", color: "#2ecc71", icon: <ShieldCheck size={16} /> };
    if (score >= 40)
      return { label: "Reliable", color: "#3498db", icon: <Handshake size={16} /> };
    return { label: "Unreliable", color: "#e74c3c", icon: <AlertTriangle size={16} /> };
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");

      // Use the URL param, or fall back to own profile
      const profileId = id || currentUser?.id;
      if (!profileId) { setLoading(false); return; }

      // Step 1 — load the profile (critical, must succeed)
      try {
        const res = await userAPI.getProfile(profileId);
        setUser(res.data.user);
      } catch (err) {
        console.error("Profile load error:", err.response?.data || err.message);
        setError("User not found or failed to load profile.");
        setLoading(false);
        return;
      }

      // Step 2 — check friend status for other users (non-critical, can fail silently)
      if (profileId !== currentUser?.id) {
        try {
          const friendRes = await friendAPI.getFriends();
          const iFriend = friendRes.data.friends.some((f) => f.id === profileId);
          setIsFollowing(iFriend);
        } catch (err) {
          console.warn("Could not load friend status:", err.message);
          // Don't block profile display
        }
      }

      setLoading(false);
    };

    if (currentUser) {
      fetchProfile();
    }
  }, [id, currentUser]);


  const handleFollowUser = async () => {
    try {
      await friendAPI.addFriend(user.id);
      setIsFollowing(true);
      setUser((prev) => ({
        ...prev,
        friendsCount: (prev.friendsCount || 0) + 1,
      }));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add friend");
    }
  };

  const handleUnfollowUser = async () => {
    if (!window.confirm("Are you sure you want to remove this friend?")) return;
    try {
      await friendAPI.removeFriend(user.id);
      setIsFollowing(false);
      setUser((prev) => ({
        ...prev,
        friendsCount: Math.max(0, (prev.friendsCount || 1) - 1),
      }));
    } catch (err) {
      alert("Failed to remove friend");
    }
  };

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
        <div className="spinner" />
      </div>
    );
  if (error) return <div className="page-content empty-state">{error}</div>;
  if (!user) return null;

  const isOwnProfile = user.id === currentUser?.id;
  const trust = getTrustTier(user.trustScore || 50);

  return (
    <div className="page-content">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-wrapper">
          <div
            className="avatar avatar--2xl"
            style={{ borderColor: trust.color, borderWidth: "3px" }}
          >
            {user.profilePhoto ? (
              <img src={user.profilePhoto} alt={user.displayName} />
            ) : (
              getInitials(user.displayName)
            )}
          </div>
        </div>

        <h1 className="profile-name">{user.displayName}</h1>

        {user.bio && <p className="profile-bio">{user.bio}</p>}

        {/* Trust Score */}
        <div className="trust-meter">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-2)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-flex" }}>{trust.icon}</span>
              <span style={{ fontWeight: 700, color: trust.color }}>
                {trust.label}
              </span>
            </span>
            <span className="badge badge--primary">
              {user.trustScore || 50} pts
            </span>
          </div>
          <div className="trust-bar">
            <div
              className="trust-bar-fill"
              style={{ width: `${user.trustScore || 50}%` }}
            />
          </div>
          <div className="trust-label">
            <span>0</span>
            <span>Trust Score</span>
            <span>100</span>
          </div>
        </div>

        {/* Stats — only visible on own profile for privacy */}
        {isOwnProfile && (
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-value">{user.hostedCount || 0}</div>
              <div className="profile-stat-label">Hosted</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{user.joinedCount || 0}</div>
              <div className="profile-stat-label">Joined</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{user.friendsCount || 0}</div>
              <div className="profile-stat-label">Friends</div>
            </div>
          </div>
        )}

        {isOwnProfile ? (
          <Link
            to="/profile/edit"
            className="btn btn--secondary"
            id="edit-profile-btn"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Pencil size={16} /> Edit Profile
          </Link>
        ) : (
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            {isFollowing ? (
              <button
                className="btn"
                style={{
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
                onClick={handleUnfollowUser}
              >
                Remove Friend
              </button>
            ) : (
              <button
                className="btn btn--primary"
                onClick={handleFollowUser}
              >
                Add Friend
              </button>
            )}
            <button
              className="btn btn--secondary"
              onClick={() => navigate(`/chat/${user.id}`)}
            >
              <MessageSquare size={16} /> Message
            </button>
            <button
              className="btn btn--sm"
              style={{
                background: "transparent",
                border: "1px solid #e74c3c",
                color: "#e74c3c",
              }}
              onClick={() => setShowReportModal(true)}
            >
              <Flag size={16} /> Report
            </button>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "440px",
              padding: "var(--space-6)",
            }}
          >
            {reportDone ? (
              <div style={{ textAlign: "center", padding: "var(--space-6)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-4)" }}>
                  <CheckCircle size={48} color="#2ecc71" />
                </div>
                <h3>Report Submitted</h3>
                <p style={{ color: "var(--color-text-secondary)" }}>
                  Our team will review this report. Thank you.
                </p>
                <button
                  className="btn btn--primary"
                  style={{ marginTop: "var(--space-4)" }}
                  onClick={() => {
                    setShowReportModal(false);
                    setReportDone(false);
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Flag size={18} /> Report {user.displayName}
                </h3>
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: "var(--space-2)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    Reason *
                  </label>
                  <select
                    className="input"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    <option value="">Select a reason...</option>
                    <option value="Spam">Spam</option>
                    <option value="Fake Identity">Fake Identity</option>
                    <option value="Harassment">Harassment</option>
                    <option value="Trust Score Manipulation">
                      Trust Score Manipulation
                    </option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: "var(--space-2)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    Additional Details (optional)
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    style={{ resize: "vertical" }}
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Describe what happened..."
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    className="btn btn--secondary"
                    onClick={() => setShowReportModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn--danger"
                    disabled={!reportReason || reportSubmitting}
                    onClick={async () => {
                      setReportSubmitting(true);
                      try {
                        await reportAPI.reportUser(
                          user.id,
                          reportReason,
                          reportDesc,
                        );
                        setReportDone(true);
                      } catch (err) {
                        alert(
                          err.response?.data?.error ||
                            "Failed to submit report.",
                        );
                      } finally {
                        setReportSubmitting(false);
                      }
                    }}
                  >
                    {reportSubmitting ? (
                      <span className="spinner" />
                    ) : (
                      "Submit Report"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interests */}
      {user.interests && user.interests.length > 0 && (
        <div
          className="profile-section animate-fade-in-up"
          style={{ animationDelay: "100ms" }}
        >
          <h2
            style={{
              fontSize: "var(--text-lg)",
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Target size={20} /> Interests
          </h2>
          <div
            className="profile-interests"
            style={{ justifyContent: "flex-start" }}
          >
            {user.interests.map((interest) => (
              <span key={interest} className="tag tag--active">
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activities — only visible on own profile for privacy */}
      {isOwnProfile && (
      <div
        className="profile-section animate-fade-in-up"
        style={{ animationDelay: "200ms" }}
      >
        <h2
          style={{
            fontSize: "var(--text-lg)",
            marginBottom: "var(--space-4)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <ClipboardList size={20} /> Recent Activities
        </h2>
        {!user.hostedActivities?.length && !user.activityMembers?.length ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Target size={40} /></div>
            <h3 className="empty-state-title">No activities yet</h3>
            <p className="empty-state-text">
              Hosted and joined activities will appear here.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            {user.hostedActivities?.map((activity) => {
              const now = new Date();
              const actDate = new Date(activity.date);
              const pts = user.pointsByActivity?.[activity.id];
              let hostLabel, hostColor, hostIcon;
              if (activity.status === "COMPLETED") {
                hostLabel = "Successfully Hosted";
                hostColor = "#2ecc71";
                hostIcon = <CheckCircle size={14} />;
              } else if (activity.status === "CANCELLED") {
                hostLabel = "Failed to Host";
                hostColor = "#e74c3c";
                hostIcon = <XCircle size={14} />;
              } else if (actDate > now) {
                hostLabel = "Upcoming Hosting";
                hostColor = "#3498db";
                hostIcon = <ClipboardList size={14} />;
              } else {
                hostLabel = "Ongoing / Pending End";
                hostColor = "#f39c12";
                hostIcon = <ClipboardList size={14} />;
              }

              return (
                <Link
                  to={`/activities/${activity.id}`}
                  key={`hosted-${activity.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    className="card card--hover"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-4)",
                    }}
                  >
                    <div>
                      <span
                        className="badge"
                        style={{
                          background: "transparent",
                          color: hostColor,
                          border: `1px solid ${hostColor}`,
                          marginBottom: "var(--space-2)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        {hostIcon} {hostLabel}
                      </span>
                      <h4 style={{ margin: 0, fontSize: "var(--text-base)" }}>
                        {activity.title}
                      </h4>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-muted)",
                          marginTop: "4px",
                        }}
                      >
                        {new Date(activity.date).toLocaleDateString()}
                      </div>
                    </div>
                    {pts !== undefined && pts !== 0 && (
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "var(--text-sm)",
                          color: pts > 0 ? "#2ecc71" : "#e74c3c",
                          background: pts > 0 ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)",
                          borderRadius: "var(--radius-full)",
                          padding: "4px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pts > 0 ? `+${pts}` : pts} pts
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
            {user.activityMembers?.map((member) => {
              const now = new Date();
              const actDate = new Date(member.activity.date);
              const pts = user.pointsByActivity?.[member.activity.id];
              let memberLabel, memberColor, memberIcon;
              if (member.activity.status === "COMPLETED") {
                memberLabel = "Successfully Attended";
                memberColor = "#2ecc71";
                memberIcon = <CheckCircle size={14} />;
              } else if (member.activity.status === "CANCELLED") {
                memberLabel = "Missed Event";
                memberColor = "#e74c3c";
                memberIcon = <XCircle size={14} />;
              } else if (actDate > now) {
                memberLabel = "Upcoming Activity";
                memberColor = "#3498db";
                memberIcon = <Calendar size={14} />;
              } else {
                memberLabel = member.isCoHost ? "Ongoing / Pending End" : "Pending Verification";
                memberColor = "#f39c12";
                memberIcon = member.isCoHost ? <ClipboardList size={14} /> : <Clock size={14} />;
              }

              return (
                <Link
                  to={`/activities/${member.activity.id}`}
                  key={`joined-${member.activity.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    className="card card--hover"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-4)",
                    }}
                  >
                    <div>
                      <span
                        className="badge"
                        style={{
                          background: memberColor,
                          color: "#fff",
                          marginBottom: "var(--space-2)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        {memberIcon} {memberLabel}
                      </span>
                      <h4 style={{ margin: 0, fontSize: "var(--text-base)" }}>
                        {member.activity.title}
                      </h4>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-muted)",
                          marginTop: "4px",
                        }}
                      >
                        {new Date(member.activity.date).toLocaleDateString()}
                      </div>
                    </div>
                    {pts !== undefined && pts !== 0 && (
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "var(--text-sm)",
                          color: pts > 0 ? "#2ecc71" : "#e74c3c",
                          background: pts > 0 ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)",
                          borderRadius: "var(--radius-full)",
                          padding: "4px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pts > 0 ? `+${pts}` : pts} pts
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default ProfilePage;
