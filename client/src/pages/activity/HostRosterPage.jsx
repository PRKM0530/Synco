import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { activityAPI } from "../../services/api";

const HostRosterPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const [members, setMembers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [roster, setRoster] = useState({}); // { userId: boolean }
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await activityAPI.getVerifications(id);
        setActivity(res.data.activity);
        // Exclude the host from roster
        const nonHostMembers = res.data.members.filter(
          (m) => m.userId !== res.data.activity.hostId,
        );
        setMembers(nonHostMembers);
        setVerifications(res.data.verifications);
        // Default all to attended
        const defaultRoster = {};
        nonHostMembers.forEach((m) => {
          defaultRoster[m.userId] = true;
        });
        setRoster(defaultRoster);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load roster.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const getVerificationForMember = (userId) =>
    verifications.find((v) => v.participantId === userId);

  const getVoteLabel = (v) => {
    if (!v) return { label: "No Response", color: "#95a5a6", emoji: "—" };
    if (v.choice === "YES_ATTENDED")
      return { label: "Claims Attended", color: "#2ecc71", emoji: "✅" };
    if (v.choice === "NO_DID_NOT_ATTEND")
      return { label: "Self-Reported Absent", color: "#e74c3c", emoji: "❌" };
    return { label: "Voted Not Conducted", color: "#f39c12", emoji: "🚫" };
  };

  const handleSubmitRoster = async () => {
    setSubmitting(true);
    setError("");
    try {
      const rosterArray = Object.entries(roster).map(([userId, attended]) => ({
        userId,
        attended,
      }));
      await activityAPI.submitRoster(id, rosterArray);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit roster.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div
        className="page-content"
        style={{ display: "flex", justifyContent: "center", marginTop: 80 }}
      >
        <span className="spinner" />
      </div>
    );
  if (error && !activity)
    return <div className="page-content empty-state">{error}</div>;

  const hasStarted = activity && new Date() >= new Date(activity.date);

  return (
    <div
      className="page-content animate-fade-in"
      style={{ maxWidth: "520px", margin: "0 auto" }}
    >
      <button
        className="btn btn--secondary btn--sm"
        style={{ marginBottom: "var(--space-4)" }}
        onClick={() => navigate(`/activities/${id}`)}
      >
        ← Back to Activity
      </button>

      <h1 className="page-title" style={{ fontSize: "var(--text-2xl)" }}>
        📋 Attendance Roster
      </h1>
      {activity && (
        <p
          style={{
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-2)",
          }}
        >
          {activity.title}
        </p>
      )}
      <p
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--text-sm)",
          marginBottom: "var(--space-6)",
        }}
      >
        Mark who actually attended. This determines trust score distribution.
      </p>

      {!hasStarted && (
        <div
          className="card"
          style={{
            background: "rgba(52, 152, 219, 0.1)",
            border: "1px solid #3498db",
            padding: "var(--space-6)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-3)" }}>
            ⏳
          </div>
          <h3 style={{ color: "#3498db" }}>Activity hasn't started yet</h3>
        </div>
      )}

      {hasStarted && !done && (
        <>
          {activity.status === "COMPLETED" ? (
            <div
              className="card"
              style={{
                background: "rgba(46, 204, 113, 0.1)",
                border: "1px solid #2ecc71",
                padding: "var(--space-6)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "#2ecc71" }}>Activity already completed.</h3>
              <p style={{ color: "var(--color-text-secondary)" }}>
                Scores have been calculated.
              </p>
            </div>
          ) : (
            <>
              {members.length === 0 ? (
                <div className="card empty-state">
                  <div className="empty-state-icon">👥</div>
                  <p className="empty-state-text">
                    No members joined this activity.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    marginBottom: "var(--space-6)",
                  }}
                >
                  {members.map((member) => {
                    const v = getVerificationForMember(member.userId);
                    const voteInfo = getVoteLabel(v);
                    const isAttended = roster[member.userId] ?? true;

                    return (
                      <div
                        key={member.userId}
                        className="card"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-4)",
                          padding: "var(--space-4)",
                          border: `1px solid ${isAttended ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"}`,
                        }}
                      >
                        {/* Avatar */}
                        <div className="avatar avatar--md">
                          {member.user.profilePhoto ? (
                            <img
                              src={member.user.profilePhoto}
                              alt={member.user.displayName}
                            />
                          ) : (
                            member.user.displayName?.[0]?.toUpperCase()
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "var(--text-sm)",
                            }}
                          >
                            {member.user.displayName}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--text-xs)",
                              color: voteInfo.color,
                              marginTop: 2,
                            }}
                          >
                            {voteInfo.emoji} {voteInfo.label}
                          </div>
                        </div>

                        {/* Toggle */}
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <button
                            onClick={() =>
                              setRoster((r) => ({
                                ...r,
                                [member.userId]: true,
                              }))
                            }
                            style={{
                              padding: "6px 12px",
                              borderRadius: "var(--radius-md)",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: "var(--text-xs)",
                              background: isAttended
                                ? "#2ecc71"
                                : "var(--color-surface-hover)",
                              color: isAttended
                                ? "#fff"
                                : "var(--color-text-secondary)",
                            }}
                          >
                            Attended
                          </button>
                          <button
                            onClick={() =>
                              setRoster((r) => ({
                                ...r,
                                [member.userId]: false,
                              }))
                            }
                            style={{
                              padding: "6px 12px",
                              borderRadius: "var(--radius-md)",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: "var(--text-xs)",
                              background: !isAttended
                                ? "#e74c3c"
                                : "var(--color-surface-hover)",
                              color: !isAttended
                                ? "#fff"
                                : "var(--color-text-secondary)",
                            }}
                          >
                            Absent
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                className="card"
                style={{
                  background: "rgba(108, 92, 231, 0.08)",
                  border: "1px solid var(--color-border)",
                  padding: "var(--space-4)",
                  marginBottom: "var(--space-4)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                ℹ️ <strong>Score Rules:</strong> Attended + "Yes I attended" =
                +2 pts each. Mismatch or no-show = -5 pts each. You earn +5 base
                pts + up to +2 per positive feedback (max +10 total).
              </div>

              {error && (
                <p
                  style={{
                    color: "#e74c3c",
                    marginBottom: "var(--space-4)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {error}
                </p>
              )}

              <button
                className="btn btn--primary btn--full btn--lg"
                onClick={handleSubmitRoster}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="spinner" />
                ) : (
                  "✅ Submit Roster & End Activity"
                )}
              </button>
            </>
          )}
        </>
      )}

      {done && (
        <div
          className="card"
          style={{
            background: "rgba(46, 204, 113, 0.1)",
            border: "1px solid #2ecc71",
            padding: "var(--space-8)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "var(--space-4)" }}>
            🎉
          </div>
          <h2 style={{ color: "#2ecc71" }}>Activity Completed!</h2>
          <p
            style={{
              color: "var(--color-text-secondary)",
              marginTop: "var(--space-2)",
            }}
          >
            Trust scores have been updated for all participants.
          </p>
          <button
            className="btn btn--primary"
            style={{ marginTop: "var(--space-6)" }}
            onClick={() => navigate("/")}
          >
            Go Home
          </button>
        </div>
      )}
    </div>
  );
};

export default HostRosterPage;
