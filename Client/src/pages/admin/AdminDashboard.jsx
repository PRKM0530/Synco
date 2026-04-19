import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { adminAPI } from "../../services/api";
import {
  Shield, Users, Target, Flag, Hourglass, CheckCircle,
  Ban, AlertTriangle, XCircle, ChevronDown, ChevronUp, FileText
} from "lucide-react";

/**
 * Moderation Status Lifecycle:
 *  PENDING     → New report, awaiting admin review.
 *  WARNED      → Admin reviewed, minor violation. User warned. No ban.
 *  ACTION_TAKEN → Serious violation. User was banned.
 *  DISMISSED   → Report reviewed, no violation found. Report closed.
 */
const STATUS_META = {
  PENDING:      { label: "Pending Review", color: "#f39c12", icon: <Hourglass size={12}/> },
  WARNED:       { label: "User Warned",    color: "#3498db", icon: <AlertTriangle size={12}/> },
  ACTION_TAKEN: { label: "User Banned",    color: "#e74c3c", icon: <Ban size={12}/> },
  DISMISSED:    { label: "Dismissed",      color: "#95a5a6", icon: <XCircle size={12}/> },
};

const FILTER_TABS = ["PENDING", "WARNED", "ACTION_TAKEN", "DISMISSED", "ALL"];

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    if (user && user.role !== "ADMIN") { navigate("/"); return; }
    fetchData();
  }, [user]);

  useEffect(() => { fetchReports(); }, [statusFilter]);

  const fetchData = async () => {
    try {
      const [statsRes, reportsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getReports(statusFilter),
      ]);
      setStats(statsRes.data.stats);
      setReports(reportsRes.data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await adminAPI.getReports(statusFilter);
      setReports(res.data.reports);
    } catch {}
  };

  const refreshStats = async () => {
    try {
      const statsRes = await adminAPI.getStats();
      setStats(statsRes.data.stats);
    } catch {}
  };

  /** Warn user: save notes, mark report as WARNED (no ban) */
  const handleWarn = async (reportId) => {
    const notes = adminNotes[reportId] || "";
    if (!notes.trim()) {
      alert("Please add an admin note explaining why you are warning this user.");
      return;
    }
    setActionLoading(reportId + "WARNED");
    try {
      await adminAPI.resolveReport(reportId, "WARNED", notes);
      setReports((prev) =>
        prev.map((r) => r.id === reportId ? { ...r, status: "WARNED", adminNotes: notes } : r)
      );
      setExpandedReport(null);
      await refreshStats();
    } catch (err) {
      alert(err.response?.data?.error || "Action failed.");
    } finally {
      setActionLoading("");
    }
  };

  /** Dismiss: no violation found, close report */
  const handleDismiss = async (reportId) => {
    const notes = adminNotes[reportId] || "";
    setActionLoading(reportId + "DISMISSED");
    try {
      await adminAPI.resolveReport(reportId, "DISMISSED", notes);
      setReports((prev) =>
        prev.map((r) => r.id === reportId ? { ...r, status: "DISMISSED", adminNotes: notes } : r)
      );
      setExpandedReport(null);
      await refreshStats();
    } catch (err) {
      alert(err.response?.data?.error || "Action failed.");
    } finally {
      setActionLoading("");
    }
  };

  /** Ban/Unban: calls ban API, then marks report ACTION_TAKEN */
  const handleBanToggle = async (reportId, userId, isBanned) => {
    if (!window.confirm(isBanned ? "Unban this user?" : "Ban this user? They will be blocked from the platform.")) return;
    setActionLoading(userId);
    try {
      if (isBanned) {
        await adminAPI.unbanUser(userId);
        await adminAPI.resolveReport(reportId, "WARNED", adminNotes[reportId] || "User unbanned by admin.");
        setReports((prev) => prev.map((r) =>
          r.id === reportId ? { ...r, status: "WARNED", reportedUser: { ...r.reportedUser, isBanned: false } } : r
        ));
      } else {
        await adminAPI.banUser(userId);
        // banUser backend already marks pending reports as ACTION_TAKEN, but force local state too
        const notes = adminNotes[reportId] || "User banned by admin.";
        await adminAPI.resolveReport(reportId, "ACTION_TAKEN", notes);
        setReports((prev) => prev.map((r) =>
          r.id === reportId ? { ...r, status: "ACTION_TAKEN", adminNotes: notes, reportedUser: { ...r.reportedUser, isBanned: true } } : r
        ));
      }
      setExpandedReport(null);
      await refreshStats();
    } catch (err) {
      alert(err.response?.data?.error || "Failed.");
    } finally {
      setActionLoading("");
    }
  };

  if (!user || user.role !== "ADMIN") return null;

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", marginTop: 100 }}>
      <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
    </div>
  );

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header">
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Shield size={28} /> Admin Dashboard
        </h1>
        <p className="page-subtitle">Synco platform management & moderation</p>
      </div>

      {/* Stats Row */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
          {[
            { label: "Total Users",     value: stats.userCount,     icon: <Users size={28}/>,    color: "#6c5ce7" },
            { label: "Activities",      value: stats.activityCount, icon: <Target size={28}/>,   color: "#00cec9" },
            { label: "Total Reports",   value: stats.reportCount,   icon: <Flag size={28}/>,     color: "#fd79a8" },
            { label: "Pending Review",  value: stats.pendingReports,icon: <Hourglass size={28}/>,color: "#f39c12" },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center", padding: "var(--space-5)", border: `1px solid ${stat.color}33` }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-2)", color: stat.color }}>{stat.icon}</div>
              <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Moderation Legend */}
      <div className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-5)", background: "rgba(108,92,231,0.05)", border: "1px solid var(--color-border)" }}>
        <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 700, marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: "6px" }}>
          <FileText size={16} /> Report Resolution Guide
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#f39c12", marginTop: 2 }}><Hourglass size={12}/></span>
            <span><strong>Pending Review</strong> — New report, not yet acted upon.</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#3498db", marginTop: 2 }}><AlertTriangle size={12}/></span>
            <span><strong>Warn User</strong> — Minor violation found. User warned, not banned. Useful for first-time offences.</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#e74c3c", marginTop: 2 }}><Ban size={12}/></span>
            <span><strong>Ban User</strong> — Serious violation. User is banned from the platform.</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#95a5a6", marginTop: 2 }}><XCircle size={12}/></span>
            <span><strong>Dismiss</strong> — No violation found. Report is closed with no action.</span>
          </div>
        </div>
      </div>

      {/* Reports Panel */}
      <div className="card" style={{ padding: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Flag size={20} /> User Reports
          </h2>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {FILTER_TABS.map((s) => {
              const meta = STATUS_META[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-full)",
                    border: "none",
                    cursor: "pointer",
                    background: statusFilter === s ? (meta?.color || "var(--color-primary)") : "var(--color-surface-hover)",
                    color: statusFilter === s ? "#fff" : "var(--color-text-secondary)",
                    fontWeight: 600,
                    fontSize: "var(--text-xs)",
                    transition: "all 0.2s",
                  }}
                >
                  {meta?.label || "All Reports"}
                </button>
              );
            })}
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="empty-state" style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-4)" }}>
              <CheckCircle size={48} color="var(--color-success)" />
            </div>
            <h3 className="empty-state-title">No {statusFilter === "ALL" ? "" : statusFilter.toLowerCase().replace("_", " ")} reports</h3>
            <p className="empty-state-text">The platform is clean!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {reports.map((report) => {
              const meta = STATUS_META[report.status] || STATUS_META.PENDING;
              const isExpanded = expandedReport === report.id;

              return (
                <div
                  key={report.id}
                  className="card"
                  style={{
                    padding: "var(--space-4)",
                    border: `1px solid ${meta.color}44`,
                    transition: "all 0.2s",
                  }}
                >
                  {/* Report Summary Row */}
                  <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start", flexWrap: "wrap" }}>

                    {/* Reporter */}
                    <div style={{ minWidth: "110px" }}>
                      <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reporter</div>
                      <Link to={`/profile/${report.reporter.id}`} style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none", color: "inherit" }}>
                        <div className="avatar avatar--sm">
                          {report.reporter.profilePhoto ? <img src={report.reporter.profilePhoto} alt="" /> : report.reporter.displayName?.[0]}
                        </div>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{report.reporter.displayName}</span>
                      </Link>
                    </div>

                    {/* Arrow */}
                    <div style={{ alignSelf: "center", color: "var(--color-text-muted)", fontSize: "1.2rem" }}>→</div>

                    {/* Reported User */}
                    <div style={{ minWidth: "110px" }}>
                      <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reported</div>
                      <Link to={`/profile/${report.reportedUser.id}`} style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none", color: "inherit" }}>
                        <div className="avatar avatar--sm" style={{ border: report.reportedUser.isBanned ? "2px solid #e74c3c" : "none" }}>
                          {report.reportedUser.profilePhoto ? <img src={report.reportedUser.profilePhoto} alt="" /> : report.reportedUser.displayName?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{report.reportedUser.displayName}</div>
                          <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Score: {report.reportedUser.trustScore}</div>
                        </div>
                      </Link>
                      {report.reportedUser.isBanned && (
                        <span style={{ fontSize: "10px", color: "#e74c3c", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px", marginTop: 4 }}>
                          <Ban size={10} /> BANNED
                        </span>
                      )}
                    </div>

                    {/* Reason */}
                    <div style={{ flex: 1, minWidth: "140px" }}>
                      <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reason</div>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 4 }}>{report.reason}</div>
                      {report.description && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>{report.description}</div>
                      )}
                      {report.adminNotes && (
                        <div style={{ marginTop: 6, fontSize: "var(--text-xs)", color: "var(--color-primary-light)", fontStyle: "italic", background: "rgba(108,92,231,0.07)", padding: "4px 8px", borderRadius: "var(--radius-sm)" }}>
                          📝 Admin note: {report.adminNotes}
                        </div>
                      )}
                    </div>

                    {/* Status + Toggle */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "flex-end" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", fontSize: "10px", fontWeight: 700, background: meta.color + "22", color: meta.color, display: "flex", alignItems: "center", gap: "4px" }}>
                        {meta.icon} {meta.label}
                      </span>
                      <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                        {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                      {(report.status === "PENDING" || report.status === "ACTION_TAKEN") && (
                        <button
                          className="btn btn--sm"
                          style={{ background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "4px" }}
                          onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                        >
                          {isExpanded ? <><ChevronUp size={13}/> Close</> : (report.status === "PENDING" ? <><ChevronDown size={13}/> Take Action</> : <><ChevronDown size={13}/> Manage</>)}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Action Panel — For PENDING or ACTION_TAKEN reports */}
                  {isExpanded && (report.status === "PENDING" || report.status === "ACTION_TAKEN") && (
                    <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)" }}>
                      <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
                        Admin Notes <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(saved with action — visible in history)</span>
                      </label>
                      <textarea
                        className="input"
                        rows={2}
                        style={{ resize: "vertical", marginBottom: "var(--space-4)" }}
                        value={adminNotes[report.id] || report.adminNotes || ""}
                        onChange={(e) => setAdminNotes((n) => ({ ...n, [report.id]: e.target.value }))}
                        placeholder="Describe what you observed and why you're taking this action..."
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)" }}>
                        {/* Warn */}
                        {report.status === "PENDING" && (
                          <button
                            className="btn btn--sm"
                            disabled={!!actionLoading}
                            onClick={() => handleWarn(report.id)}
                            style={{ background: "rgba(52,152,219,0.12)", color: "#3498db", border: "1px solid #3498db", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px" }}
                          >
                            {actionLoading === report.id + "WARNED" ? <span className="spinner" /> : (
                              <>
                                <AlertTriangle size={14}/>
                                <div>
                                  <div style={{ fontWeight: 700 }}>Warn User</div>
                                  <div style={{ fontSize: "10px", opacity: 0.8 }}>Minor violation, no ban</div>
                                </div>
                              </>
                            )}
                          </button>
                        )}

                        {/* Ban / Unban */}
                        <button
                          className="btn btn--sm"
                          disabled={!!actionLoading}
                          onClick={() => handleBanToggle(report.id, report.reportedUser.id, report.reportedUser.isBanned)}
                          style={{
                            background: report.reportedUser.isBanned ? "rgba(46,204,113,0.12)" : "rgba(231,76,60,0.12)",
                            color: report.reportedUser.isBanned ? "#2ecc71" : "#e74c3c",
                            border: `1px solid ${report.reportedUser.isBanned ? "#2ecc71" : "#e74c3c"}`,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px",
                            gridColumn: report.status === "ACTION_TAKEN" ? "span 3" : "auto"
                          }}
                        >
                          {actionLoading === report.reportedUser.id ? <span className="spinner" /> : (
                            <>
                              <Ban size={14}/>
                              <div>
                                <div style={{ fontWeight: 700 }}>{report.reportedUser.isBanned ? "Unban User" : "Ban User"}</div>
                                <div style={{ fontSize: "10px", opacity: 0.8 }}>{report.reportedUser.isBanned ? "Re-enable account" : "Block from platform"}</div>
                              </div>
                            </>
                          )}
                        </button>

                        {/* Dismiss */}
                        {report.status === "PENDING" && (
                          <button
                            className="btn btn--sm"
                            disabled={!!actionLoading}
                            onClick={() => handleDismiss(report.id)}
                            style={{ background: "rgba(149,165,166,0.12)", color: "#95a5a6", border: "1px solid #95a5a6", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px" }}
                          >
                            {actionLoading === report.id + "DISMISSED" ? <span className="spinner" /> : (
                              <>
                                <XCircle size={14}/>
                                <div>
                                  <div style={{ fontWeight: 700 }}>Dismiss</div>
                                  <div style={{ fontSize: "10px", opacity: 0.8 }}>No violation found</div>
                                </div>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
