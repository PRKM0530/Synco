import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { activityAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const VerifyAttendancePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null);
  const [choice, setChoice] = useState(null); // 'YES_ATTENDED' | 'NO_DID_NOT_ATTEND' | 'NOT_CONDUCTED'
  const [hostFeedback, setHostFeedback] = useState(null); // 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [actRes, myVerRes] = await Promise.all([
          activityAPI.getActivityById(id),
          activityAPI.getMyVerification(id),
        ]);
        setActivity(actRes.data.activity);
        setExisting(myVerRes.data.verification);
      } catch {
        setError("Failed to load activity.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async () => {
    if (!choice) return;
    if (choice === "YES_ATTENDED" && !hostFeedback) return;
    setSubmitting(true);
    setError("");
    try {
      await activityAPI.submitVerification(id, choice, hostFeedback);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Submission failed.");
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
      style={{ maxWidth: "500px", margin: "0 auto" }}
    >
      <button
        className="btn btn--secondary btn--sm"
        style={{ marginBottom: "var(--space-4)" }}
        onClick={() => navigate(`/activities/${id}`)}
      >
        ← Back to Activity
      </button>

      <h1 className="page-title" style={{ fontSize: "var(--text-2xl)" }}>
        📋 Verify Attendance
      </h1>
      {activity && (
        <p
          style={{
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-6)",
          }}
        >
          {activity.title}
        </p>
      )}

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
          <p style={{ color: "var(--color-text-secondary)" }}>
            Verification opens once the activity starts.
          </p>
        </div>
      )}

      {hasStarted && existing && (
        <div
          className="card"
          style={{
            background: "rgba(46, 204, 113, 0.1)",
            border: "1px solid #2ecc71",
            padding: "var(--space-6)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-3)" }}>
            ✅
          </div>
          <h3 style={{ color: "#2ecc71" }}>Already Submitted</h3>
          <p
            style={{
              color: "var(--color-text-secondary)",
              marginTop: "var(--space-2)",
            }}
          >
            Your response:{" "}
            <strong>
              {existing.choice === "YES_ATTENDED"
                ? "✅ Yes, I attended"
                : existing.choice === "NOT_CONDUCTED"
                  ? "🚫 Activity not conducted"
                  : "❌ No, I did not attend"}
            </strong>
            {existing.hostFeedback && (
              <>
                <br />
                Your feedback: <strong>{existing.hostFeedback}</strong>
              </>
            )}
          </p>
        </div>
      )}

      {hasStarted && !existing && !done && (
        <div className="card" style={{ padding: "var(--space-6)" }}>
          <h2
            style={{
              marginBottom: "var(--space-2)",
              fontSize: "var(--text-lg)",
            }}
          >
            Did this activity take place, and did you attend?
          </h2>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
              marginBottom: "var(--space-6)",
            }}
          >
            Your response affects your Trust Score and the host's reputation.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              marginBottom: "var(--space-6)",
            }}
          >
            {/* Option 1 */}
            <button
              onClick={() => setChoice("YES_ATTENDED")}
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${choice === "YES_ATTENDED" ? "#2ecc71" : "var(--color-border)"}`,
                background:
                  choice === "YES_ATTENDED"
                    ? "rgba(46, 204, 113, 0.1)"
                    : "var(--color-surface)",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{ fontWeight: 600, color: "#2ecc71", marginBottom: 4 }}
              >
                ✅ Yes, I attended
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                You'll also rate the host. +2 pts if verified.
              </div>
            </button>

            {/* Option 2 */}
            <button
              onClick={() => {
                setChoice("NO_DID_NOT_ATTEND");
                setHostFeedback(null);
              }}
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${choice === "NO_DID_NOT_ATTEND" ? "#e74c3c" : "var(--color-border)"}`,
                background:
                  choice === "NO_DID_NOT_ATTEND"
                    ? "rgba(231, 76, 60, 0.1)"
                    : "var(--color-surface)",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{ fontWeight: 600, color: "#e74c3c", marginBottom: 4 }}
              >
                ❌ No, I did not attend
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                -5 pts applied immediately.
              </div>
            </button>

            {/* Option 3 */}
            <button
              onClick={() => {
                setChoice("NOT_CONDUCTED");
                setHostFeedback(null);
              }}
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${choice === "NOT_CONDUCTED" ? "#f39c12" : "var(--color-border)"}`,
                background:
                  choice === "NOT_CONDUCTED"
                    ? "rgba(243, 156, 18, 0.1)"
                    : "var(--color-surface)",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{ fontWeight: 600, color: "#f39c12", marginBottom: 4 }}
              >
                🚫 Activity was not conducted
              </div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                If &gt;50% agree, host gets -10 pts.
              </div>
            </button>
          </div>

          {/* Host Feedback — only shown if YES_ATTENDED */}
          {choice === "YES_ATTENDED" && (
            <div style={{ marginBottom: "var(--space-6)" }}>
              <h3
                style={{
                  marginBottom: "var(--space-4)",
                  fontSize: "var(--text-base)",
                }}
              >
                How was the host?
              </h3>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                {[
                  {
                    val: "POSITIVE",
                    emoji: "😊",
                    label: "Positive",
                    color: "#2ecc71",
                    pts: "+2 to host",
                  },
                  {
                    val: "NEUTRAL",
                    emoji: "😐",
                    label: "Neutral",
                    color: "#95a5a6",
                    pts: "No change",
                  },
                  {
                    val: "NEGATIVE",
                    emoji: "😞",
                    label: "Negative",
                    color: "#e74c3c",
                    pts: "-2 from host",
                  },
                ].map((fb) => (
                  <button
                    key={fb.val}
                    onClick={() => setHostFeedback(fb.val)}
                    style={{
                      flex: 1,
                      padding: "var(--space-4)",
                      borderRadius: "var(--radius-lg)",
                      border: `2px solid ${hostFeedback === fb.val ? fb.color : "var(--color-border)"}`,
                      background:
                        hostFeedback === fb.val
                          ? `${fb.color}22`
                          : "var(--color-surface)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ fontSize: "1.75rem" }}>{fb.emoji}</div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--text-sm)",
                        color: fb.color,
                      }}
                    >
                      {fb.label}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--color-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {fb.pts}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p
              style={{
                color: "#e74c3c",
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-4)",
              }}
            >
              {error}
            </p>
          )}

          <button
            className="btn btn--primary btn--full"
            onClick={handleSubmit}
            disabled={
              submitting ||
              !choice ||
              (choice === "YES_ATTENDED" && !hostFeedback)
            }
          >
            {submitting ? <span className="spinner" /> : "Submit Verification"}
          </button>
        </div>
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
          <h2 style={{ color: "#2ecc71" }}>Submitted!</h2>
          <p
            style={{
              color: "var(--color-text-secondary)",
              marginTop: "var(--space-2)",
            }}
          >
            {choice === "NO_DID_NOT_ATTEND"
              ? "Your no-show has been recorded. -5 pts applied."
              : "Your verification is recorded. Scores are calculated when the host submits the roster."}
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

export default VerifyAttendancePage;
