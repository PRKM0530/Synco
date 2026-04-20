import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { userAPI } from "../../services/api";
import { Trash2, Mail, ShieldCheck, Camera } from "lucide-react";

const INTEREST_SUGGESTIONS = [
  "Basketball", "Football", "Cricket", "Tennis", "Badminton",
  "Swimming", "Running", "Gym", "Yoga", "Study",
  "Coding", "Gaming", "Music", "Art", "Photography",
  "Coffee", "Movies", "Travel", "Reading", "Cooking",
  "Dance", "Hiking", "Cycling", "Volunteering",
];

const EditProfilePage = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({ displayName: "", bio: "", interests: [] });
  const [interestInput, setInterestInput] = useState("");

  // Email change flow
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailStep, setEmailStep] = useState("idle"); // idle | sending | otp | confirming | done
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        displayName: user.displayName || "",
        bio: user.bio || "",
        interests: user.interests || [],
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setError(""); setSuccess("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addInterest = (interest) => {
    const normalized = interest.trim();
    if (normalized && !form.interests.includes(normalized) && form.interests.length < 15) {
      setForm((prev) => ({ ...prev, interests: [...prev.interests, normalized] }));
    }
    setInterestInput("");
  };

  const removeInterest = (interest) => {
    setForm((prev) => ({ ...prev, interests: prev.interests.filter((i) => i !== interest) }));
  };

  const handleInterestKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addInterest(interestInput); }
    if (e.key === "Backspace" && !interestInput && form.interests.length > 0) {
      removeInterest(form.interests[form.interests.length - 1]);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await userAPI.uploadPhoto(formData);
      updateUser({ profilePhoto: res.data.profilePhoto });
      setSuccess("Photo updated!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload photo.");
    } finally { setPhotoLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      const res = await userAPI.updateProfile(form);
      updateUser(res.data.user);
      setSuccess("Profile updated successfully!");
      setTimeout(() => navigate("/profile"), 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile.");
    } finally { setLoading(false); }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you absolutely sure you want to delete your account? This action cannot be undone and all your data will be permanently removed."
    );
    if (!confirmed) return;
    setDeleting(true); setError("");
    try {
      await userAPI.deleteAccount();
      localStorage.removeItem("synco_token");
      localStorage.removeItem("synco_user");
      window.location.href = "/register";
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete account.");
      setDeleting(false);
    }
  };

  // Email change handlers
  const handleRequestEmailChange = async () => {
    if (!newEmail.trim()) { setEmailErr("Please enter a new email address."); return; }
    setEmailStep("sending"); setEmailErr(""); setEmailMsg("");
    try {
      const res = await userAPI.requestEmailChange(newEmail.trim());
      setEmailMsg(res.data.message);
      setEmailStep("otp");
    } catch (err) {
      setEmailErr(err.response?.data?.error || "Failed to send OTP.");
      setEmailStep("idle");
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!emailOtp.trim()) { setEmailErr("Please enter the verification code."); return; }
    setEmailStep("confirming"); setEmailErr("");
    try {
      const res = await userAPI.confirmEmailChange(newEmail.trim(), emailOtp.trim());
      updateUser({ email: res.data.newEmail });
      setEmailMsg("Email updated successfully! ✓");
      setEmailStep("done");
      setNewEmail(""); setEmailOtp("");
    } catch (err) {
      setEmailErr(err.response?.data?.error || "Invalid or expired code.");
      setEmailStep("otp");
    }
  };

  const getInitials = (name) => name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const availableSuggestions = INTEREST_SUGGESTIONS.filter((i) => !form.interests.includes(i));

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header" style={{ textAlign: "center" }}>
        <h1 className="page-title">Edit Profile</h1>
        <p className="page-subtitle">Customize your presence on Synco</p>
      </div>

      {success && (
        <div className="toast toast--success" style={{ position: "relative", top: 0, marginBottom: "var(--space-4)", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
          <span>✓</span> {success}
        </div>
      )}
      {error && (
        <div className="toast toast--error" style={{ position: "relative", top: 0, marginBottom: "var(--space-4)", maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
          <span>⚠️</span> {error}
        </div>
      )}

      <form className="edit-profile-form" onSubmit={handleSubmit}>
        {/* Avatar Upload */}
        <div className="edit-avatar-section">
          <div className="profile-avatar-wrapper">
            <div className="avatar avatar--2xl">
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt={user.displayName} />
              ) : (
                getInitials(form.displayName)
              )}
            </div>
            <label className="profile-avatar-edit" htmlFor="photo-upload" title="Change photo">
              <Camera size={18} color="#fff" />
              <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
            </label>
          </div>
          {photoLoading && <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Uploading...</span>}
        </div>

        {/* Display Name */}
        <div className="input-group">
          <label htmlFor="edit-name" className="input-label">Display Name</label>
          <input
            id="edit-name" type="text" name="displayName" className="input"
            placeholder="Your display name" value={form.displayName}
            onChange={handleChange} required minLength={2} maxLength={50}
          />
        </div>

        {/* Bio */}
        <div className="input-group">
          <label htmlFor="edit-bio" className="input-label">Bio</label>
          <textarea
            id="edit-bio" name="bio" className="input"
            placeholder="Tell people a bit about yourself..."
            value={form.bio} onChange={handleChange} maxLength={500} rows={3}
          />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textAlign: "right" }}>
            {form.bio.length}/500
          </span>
        </div>

        {/* Interests */}
        <div className="input-group">
          <label className="input-label">Interests ({form.interests.length}/15)</label>
          <div className="interests-input">
            {form.interests.map((interest) => (
              <span key={interest} className="tag tag--active" onClick={() => removeInterest(interest)} title="Click to remove" style={{ cursor: "pointer" }}>
                {interest} ×
              </span>
            ))}
            <input
              type="text"
              placeholder={form.interests.length === 0 ? "Type and press Enter..." : "Add more..."}
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={handleInterestKeyDown}
            />
          </div>
          {availableSuggestions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              {availableSuggestions.slice(0, 12).map((s) => (
                <span key={s} className="tag tag--clickable" onClick={() => addInterest(s)}>+ {s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
          <button type="button" className="btn btn--secondary btn--lg" onClick={() => navigate("/profile")} style={{ flex: 1 }}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary btn--lg" disabled={loading} id="save-profile" style={{ flex: 2 }}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* ── Change Email Section ── */}
      <div className="card card--glass animate-fade-in" style={{ marginTop: "var(--space-6)", padding: "var(--space-5)", border: "1px solid var(--color-border)" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "var(--space-2)", fontSize: "var(--text-base)" }}>
          <Mail size={18} /> Change Email Address
        </h3>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}>
          Current Email: <strong>{user?.email}</strong>
        </p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "6px" }}>
          <ShieldCheck size={13} /> Your email is private and never visible to other users.
        </p>

        {emailMsg && (
          <div className="toast toast--success" style={{ position: "relative", top: 0, marginBottom: "var(--space-3)" }}>
            ✓ {emailMsg}
          </div>
        )}
        {emailErr && (
          <div className="toast toast--error" style={{ position: "relative", top: 0, marginBottom: "var(--space-3)" }}>
            ⚠️ {emailErr}
          </div>
        )}

        {emailStep === "idle" || emailStep === "sending" ? (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end" }}>
            <div className="input-group" style={{ flex: 1, margin: 0 }}>
              <label className="input-label">New Email Address</label>
              <input
                type="email" className="input" placeholder="new@example.com"
                value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailErr(""); }}
              />
            </div>
            <button
              type="button" className="btn btn--secondary"
              onClick={handleRequestEmailChange}
              disabled={emailStep === "sending" || !newEmail.trim()}
            >
              {emailStep === "sending" ? <span className="spinner" /> : "Send OTP"}
            </button>
          </div>
        ) : emailStep === "otp" || emailStep === "confirming" ? (
          <div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-3)" }}>
              Enter the 6-digit code sent to <strong>{newEmail}</strong>
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end" }}>
              <div className="input-group" style={{ flex: 1, margin: 0 }}>
                <label className="input-label">One-Time Password</label>
                <input
                  type="text" className="input" placeholder="Enter 6-digit code" maxLength={6}
                  value={emailOtp}
                  onChange={(e) => {
                    setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setEmailErr("");
                  }}
                  style={{ fontSize: "1.5rem", letterSpacing: "4px", textAlign: "center" }}
                />
              </div>
              <button
                type="button" className="btn btn--primary"
                onClick={handleConfirmEmailChange}
                disabled={emailStep === "confirming" || !emailOtp.trim() || emailOtp.length < 6}
                style={{ height: "48px" }}
              >
                {emailStep === "confirming" ? <span className="spinner" /> : "Confirm"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setEmailStep("idle"); setEmailOtp(""); setEmailMsg(""); setEmailErr(""); }}
              style={{ marginTop: "var(--space-2)", background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}
            >
              ← Use a different email
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Danger Zone ── */}
      <div className="card card--glass animate-fade-in" style={{ marginTop: "var(--space-6)", padding: "var(--space-4)", border: "1px solid rgba(231, 76, 60, 0.3)", background: "rgba(231, 76, 60, 0.05)" }}>
        <h3 style={{ color: "var(--color-danger)", marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: "8px" }}>
          <Trash2 size={20} /> Danger Zone
        </h3>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
          Permanently delete your account and all associated data. This action is irreversible.
        </p>
        <button
          type="button" className="btn btn--danger"
          onClick={handleDeleteAccount} disabled={deleting}
          style={{ width: "100%", display: "flex", justifyContent: "center", gap: "8px" }}
        >
          {deleting ? <span className="spinner" /> : <Trash2 size={18} />}
          {deleting ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
};

export default EditProfilePage;
