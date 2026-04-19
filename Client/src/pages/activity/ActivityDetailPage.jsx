import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { activityAPI, joinAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { CATEGORIES } from "../../utils/categories";
import CategoryIcon from "../../components/common/CategoryIcon";
import { XCircle, MapPin, ExternalLink, Users, Clock, Calendar, ShieldCheck, Settings, CheckCircle, ClipboardList, Star } from "lucide-react";

import ChatRoom from "../../components/chat/ChatRoom";

const ActivityDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Join Flow State
  const [joinStatus, setJoinStatus] = useState(""); // '', 'loading', 'pending', 'joined'
  const [joinError, setJoinError] = useState("");

  const [completing, setCompleting] = useState(false);
  const [kicking, setKicking] = useState(null);
  const [togglingCoHost, setTogglingCoHost] = useState(null);

  const getTrustTier = (score) => {
    if (score >= 80) return { label: "Trusted", color: "#2ecc71" };
    if (score >= 40) return { label: "Reliable", color: "#3498db" };
    return { label: "Unreliable", color: "#e74c3c" };
  };

  // Host Requests State
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [distanceKm, setDistanceKm] = useState(null);

  // Quick frontend haversine formula helper
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchActivity = async () => {
    try {
      const res = await activityAPI.getActivityById(id);
      setActivity(res.data.activity);

      const isMember = res.data.activity.members.some(
        (m) => m.userId === user.id,
      );
      if (isMember) {
        setJoinStatus("joined");
      } else if (res.data.activity.joinRequests?.length > 0) {
        // Automatically reflect pending status if a request exists for this user
        const reqStat = res.data.activity.joinRequests[0].status;
        setJoinStatus(
          reqStat === "PENDING" ? "pending" : reqStat.toLowerCase(),
        );
      }

      // Calculate distance if geolocation allowed
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, parseFloat(res.data.activity.latitude), parseFloat(res.data.activity.longitude));
            setDistanceKm(dist);
          },
          () => {} // silently fail if no location given
        );
      }
    } catch (err) {
      setError("Failed to load activity details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await joinAPI.getRequests(id);
      setRequests(res.data.requests);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [id]);

  useEffect(() => {
    if (activity) {
      const myMembership = activity.members.find((m) => m.userId === user?.id);
      if (activity.hostId === user?.id || myMembership?.isCoHost) {
        fetchRequests();
      }
    }
  }, [activity, user]);

  useEffect(() => {
    if (activity && location.hash === "#chat") {
      const chatEl = document.getElementById("chat-section");
      if (chatEl) {
        chatEl.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [activity, location.hash]);

  const handleJoinRequest = async () => {
    setJoinStatus("loading");
    setJoinError("");
    try {
      await joinAPI.requestJoin(id);
      setJoinStatus("pending");
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to send request.";
      if (msg === "You have already sent a request.") {
        setJoinStatus("pending");
      } else if (msg === "You are already a member of this activity.") {
        setJoinStatus("joined");
      } else {
        setJoinStatus("");
        setJoinError(msg);
      }
    }
  };

  const handleResolveRequest = async (reqId, status) => {
    try {
      await joinAPI.resolveRequest(reqId, status);
      fetchRequests(); // refresh list
      if (status === "APPROVED") {
        fetchActivity(); // refresh members list
      }
    } catch (err) {
      alert("Failed to update request.");
    }
  };

  const handleLeaveActivity = async () => {
    if (!window.confirm("Are you sure you want to leave this activity?"))
      return;
    try {
      await joinAPI.leaveActivity(id);
      setJoinStatus("");
      fetchActivity(); // Refresh to remove user from members list
    } catch (err) {
      alert("Failed to leave activity.");
    }
  };

  const handleKickParticipant = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to remove ${userName}?`)) return;
    setKicking(userId);
    try {
      await joinAPI.kickParticipant(id, userId);
      setActivity((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.userId !== userId),
      }));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove participant.");
    } finally {
      setKicking(null);
    }
  };

  const handleToggleCoHost = async (member) => {
    setTogglingCoHost(member.userId);
    try {
      const res = await activityAPI.toggleCoHost(activity.id, member.userId);
      setActivity((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.userId === member.userId ? { ...m, isCoHost: res.data.isCoHost } : m
        ),
      }));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update co-host status.");
    } finally {
      setTogglingCoHost(null);
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
        <span
          className="spinner"
          style={{ width: 40, height: 40, borderWidth: 4 }}
        ></span>
      </div>
    );
  if (error || !activity)
    return (
      <div className="page-content empty-state">
        {error || "Activity not found."}
      </div>
    );

  const myMembership = activity.members.find((m) => m.userId === user?.id);
  const isHost = user?.id === activity.hostId || myMembership?.isCoHost === true;
  const isOriginalHost = user?.id === activity.hostId;
  const eventDate = new Date(activity.date);
  const getInitials = (name) => name?.charAt(0).toUpperCase() || "?";
  const hasStarted = new Date() >= eventDate;
  const autoEndTime = new Date(
    eventDate.getTime() + ((activity.duration || 60) + 180) * 60 * 1000,
  );
  const isPastAutoEnd = new Date() >= autoEndTime;

  return (
    <div
      className="page-content animate-fade-in"
      style={{ paddingBottom: "var(--space-24)" }}
    >
      {/* Header card */}
      <div
        className="card card--glass"
        style={{
          marginBottom: "var(--space-6)",
          overflow: "hidden",
          padding: 0,
        }}
      >

        <div style={{ padding: "var(--space-6)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "var(--space-4)",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-2)",
                }}
              >
                <span className="badge badge--primary" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <CategoryIcon category={activity.category} size={14} /> {activity.category}
                </span>
                <span
                  className={`badge ${activity.status === "UPCOMING" ? "badge--success" : ""}`}
                >
                  {activity.status}
                </span>
                {activity.visibility === "FRIENDS" && (
                  <span className="badge badge--warning" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Users size={14} /> Friends Only
                  </span>
                )}
              </div>
              <h1
                className="page-title"
                style={{ marginBottom: "var(--space-1)" }}
              >
                {activity.title}
              </h1>
              {distanceKm !== null && (
                 <div style={{color: "var(--color-primary)", fontWeight: "bold", fontSize: "var(--text-sm)", marginBottom: "var(--space-2)"}}>
                   {distanceKm < 1 ? "< 1 km away" : `${distanceKm.toFixed(1)} km away`}
                 </div>
              )}
              <div
                style={{
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  gap: "var(--space-3)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={16} />{" "}
                  {eventDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={16} />{" "}
                  {eventDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {activity.duration && <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={16} /> {activity.duration} mins</span>}
              </div>
            </div>

            <Link
              to={`/profile/${activity.hostId}`}
              style={{
                textAlign: "center",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                className="avatar avatar--lg"
                style={{
                  margin: "0 auto var(--space-2)",
                  border: "2px solid var(--color-primary)",
                }}
              >
                {activity.host.profilePhoto ? (
                  <img
                    src={activity.host.profilePhoto}
                    alt={activity.host.displayName}
                  />
                ) : (
                  getInitials(activity.host.displayName)
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Hosted by
                </div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                  {activity.host.displayName}
                </div>
                {(() => {
                  const tier = getTrustTier(activity.host.trustScore);
                  return (
                    <div
                      className="badge"
                      style={{
                        marginTop: "var(--space-1)",
                        background: tier.color,
                        color: "#fff",
                      }}
                    >
                      <ShieldCheck size={14} style={{ marginRight: "4px" }} /> {tier.label} · {activity.host.trustScore} pts
                    </div>
                  );
                })()}
              </div>
            </Link>
          </div>

          <p style={{ lineHeight: 1.7, marginBottom: "var(--space-6)" }}>
            {activity.description || "No description provided."}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <a
                href={`https://www.google.com/maps?q=${activity.latitude},${activity.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  color: "var(--color-primary-light)",
                  textDecoration: "none",
                  fontSize: "var(--text-sm)",
                }}
              >
                <MapPin size={16} />
                <div>
                  <div style={{ fontWeight: 600 }}>Location</div>
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
                    {activity.address}
                  </div>
                </div>
                <ExternalLink size={12} style={{ opacity: 0.6 }} />
              </a>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginLeft: "var(--space-4)",
              }}
            >
              <Users size={24} className="text-primary-light" />
              <div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                  Participants
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {activity.members.length} / {activity.maxParticipants}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <h2
          style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}
        >
          Participants
        </h2>
        <div
          style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}
        >
          {activity.members.map((member) => (
            <div key={member.id} style={{ position: "relative", textAlign: "center" }}>
              {/* Remove button (host constraints) */}
              {isHost && member.userId !== activity.hostId && member.userId !== user?.id && (isOriginalHost || !member.isCoHost) && activity.status !== "COMPLETED" && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleKickParticipant(member.userId, member.user.displayName);
                  }}
                  disabled={kicking === member.userId}
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "var(--color-surface)",
                    borderRadius: "50%",
                    display: "flex",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-danger)",
                    zIndex: 2,
                    padding: 0
                  }}
                  title="Remove Participant"
                >
                  <XCircle size={16} fill="var(--color-surface)" />
                </button>
              )}
              <Link
                to={`/profile/${member.userId}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  className="avatar"
                  style={member.isCoHost || member.userId === activity.hostId ? { border: "2px solid var(--color-primary)" } : {}}
                >
                  {member.user.profilePhoto ? (
                    <img
                      src={member.user.profilePhoto}
                      alt={member.user.displayName}
                    />
                  ) : (
                    getInitials(member.user.displayName)
                  )}
                </div>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    width: "64px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {member.user.displayName}
                </span>
                {/* Host badge */}
                {(member.userId === activity.hostId || member.isCoHost) && (
                  <span style={{
                    fontSize: "9px",
                    background: "var(--color-primary)",
                    color: "#fff",
                    borderRadius: "4px",
                    padding: "1px 5px",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                  }}>
                    HOST
                  </span>
                )}
              </Link>
              {/* Promote/Demote to host button — only for original host, on non-self members */}
              {isOriginalHost && member.userId !== activity.hostId && activity.status !== "COMPLETED" && (
                <button
                  onClick={() => handleToggleCoHost(member)}
                  disabled={togglingCoHost === member.userId}
                  title={member.isCoHost ? "Remove host access" : "Make host"}
                  style={{
                    marginTop: "2px",
                    background: member.isCoHost ? "rgba(231,76,60,0.12)" : "rgba(108,92,231,0.1)",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    padding: "2px 6px",
                    fontSize: "9px",
                    color: member.isCoHost ? "#e74c3c" : "var(--color-primary)",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  <Star size={9} />
                  {togglingCoHost === member.userId ? "..." : member.isCoHost ? "Demote" : "Make Host"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Host Controls */}
      {isHost && (
        <div
          className="card"
          style={{
            border: "1px solid var(--color-primary)",
            marginBottom: "var(--space-6)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--text-lg)",
              marginBottom: "var(--space-4)",
              color: "var(--color-primary-light)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Settings size={20} /> Host Controls
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            {/* Before start: edit + cancel */}
            {!hasStarted && activity.status !== "COMPLETED" && (
              <>
                <button
                  className="btn btn--secondary btn--full"
                  onClick={() => navigate(`/activities/${activity.id}/edit`)}
                >
                  Edit Activity
                </button>
                <button
                  className="btn btn--danger btn--full"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Cancel this activity? This cannot be undone.",
                      )
                    ) {
                      activityAPI
                        .deleteActivity(activity.id)
                        .then(() => navigate("/"));
                    }
                  }}
                >
                  Cancel Activity
                </button>
              </>
            )}

            {/* After start: submit roster to end */}
            {hasStarted && activity.status !== "COMPLETED" && (
              <>
                <div
                  style={{
                    background: "rgba(46,204,113,0.08)",
                    border: "1px solid rgba(46,204,113,0.3)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                    display: "flex",
                    gap: "8px",
                    alignItems: "center"
                  }}
                >
                  <CheckCircle size={16} color="#2ecc71" className="flex-shrink-0" />
                  <span>Activity has started. When it's done, submit the attendance
                  roster to calculate trust scores.</span>
                </div>
                <button
                  className="btn btn--success btn--full btn--lg"
                  onClick={() => navigate(`/activities/${activity.id}/roster`)}
                  style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" }}
                >
                  <ClipboardList size={18} /> Submit Attendance Roster & End Activity
                </button>
              </>
            )}

            {activity.status === "COMPLETED" && (
              <div
                style={{
                  background: "rgba(46,204,113,0.1)",
                  border: "1px solid #2ecc71",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-4)",
                  textAlign: "center",
                }}
              >
                <div style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "center" }}>
                  <CheckCircle size={32} color="#2ecc71" />
                </div>
                <div style={{ fontWeight: 600, color: "#2ecc71" }}>
                  Activity Completed
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                    marginTop: 4,
                  }}
                >
                  Trust scores have been distributed.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member Controls */}
      {!isHost && joinStatus === "joined" && (
        <div
          className="card"
          style={{
            border: "1px solid var(--color-border)",
            marginBottom: "var(--space-6)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--text-base)",
              margin: "0 0 var(--space-3)",
              fontWeight: 600,
            }}
          >
            Member Options
          </h2>

          {!hasStarted && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  margin: 0,
                }}
              >
                You are registered for this activity.
              </p>
              <button
                className="btn btn--danger btn--sm"
                onClick={handleLeaveActivity}
              >
                Leave Activity
              </button>
            </div>
          )}

          {hasStarted && activity.status !== "COMPLETED" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div
                style={{
                  background: "rgba(52,152,219,0.08)",
                  border: "1px solid rgba(52,152,219,0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center"
                }}
              >
                <Clock size={16} color="var(--color-primary)" className="flex-shrink-0" />
                <span>The activity has started! Please verify your attendance and
                rate the host.</span>
              </div>
              <button
                className="btn btn--primary btn--full"
                onClick={() => navigate(`/activities/${activity.id}/verify`)}
                style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" }}
              >
                <ClipboardList size={18} /> Verify My Attendance
              </button>
            </div>
          )}

          {activity.status === "COMPLETED" && (
            <div
              style={{
                textAlign: "center",
                padding: "var(--space-3)",
                color: "var(--color-text-muted)",
                fontSize: "var(--text-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <CheckCircle size={16} color="var(--color-success)" />
              This activity is completed. Thank you for participating!
            </div>
          )}
        </div>
      )}

      {/* Manage Requests Array (Host Only) */}
      {isHost && requests.length > 0 && (
        <div
          className="card"
          style={{ border: "1px solid var(--color-warning)" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-4)",
            }}
          >
            <h2
              style={{
                fontSize: "var(--text-lg)",
                color: "var(--color-warning)",
              }}
            >
              Join Requests
            </h2>
            <span className="badge badge--warning">
              {requests.length} pending
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            {requests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3)",
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                  }}
                >
                  <div className="avatar">
                    {req.user.profilePhoto ? (
                      <img
                        src={req.user.profilePhoto}
                        alt={req.user.displayName}
                      />
                    ) : (
                      getInitials(req.user.displayName)
                    )}
                  </div>
                  <div>
                    <div
                      style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}
                    >
                      {req.user.displayName}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Trust Score: {req.user.trustScore}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => handleResolveRequest(req.id, "REJECTED")}
                  >
                    Decline
                  </button>
                  <button
                    className="btn btn--success btn--sm"
                    onClick={() => handleResolveRequest(req.id, "APPROVED")}
                    disabled={
                      activity.members.length >= activity.maxParticipants
                    }
                  >
                    {activity.members.length >= activity.maxParticipants
                      ? "Full"
                      : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacing for mobile nav and sticky buttons */}
      <div style={{ height: "120px", width: "100%" }}></div>

      {/* Activity Chat Room (Visible to HOST or APPROVED JOINED MEMBERS) */}
      {(isHost || joinStatus === "joined") && (
        <div id="chat-section" style={{ marginBottom: "var(--space-6)" }}>
          <ChatRoom activityId={activity.id} isHost={isHost} />
        </div>
      )}

      {/* Inline Join Button — no sticky overlay */}
      {!isHost && activity.status === "UPCOMING" && joinStatus !== "joined" && (
        <div style={{ marginTop: "var(--space-6)", marginBottom: "var(--space-8)" }}>
          {joinError && (
            <div
              style={{
                color: "var(--color-danger)",
                fontSize: "var(--text-xs)",
                textAlign: "center",
                marginBottom: "var(--space-2)",
              }}
            >
              {joinError}
            </div>
          )}
          <button
            className={`btn btn--lg btn--full ${joinStatus === "pending" ? "btn--secondary" : "btn--primary"}`}
            onClick={handleJoinRequest}
            disabled={joinStatus === "pending" || joinStatus === "loading"}
          >
            {joinStatus === "loading" ? <span className="spinner" /> : null}
            {joinStatus === "pending" ? "⏳ Request Pending..." : "Request to Join"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityDetailPage;
