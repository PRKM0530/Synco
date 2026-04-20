import { useState } from "react";
import { userAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { X } from "lucide-react";

const OnboardingModal = ({ onClose, userId }) => {
  const { user, updateUser } = useAuth();
  const [bio, setBio] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addTag = (val) => {
    const trimmed = val.trim().replace(/,+$/, "").trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault(); // Prevent form submit
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && interests.length > 0) {
      setInterests((prev) => prev.slice(0, -1));
    }
  };

  const removeTag = (tag) => {
    setInterests((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Flush any pending tag that hasn't been confirmed with Enter yet
    const finalInterests = [...interests];
    if (tagInput.trim()) {
      const extra = tagInput.trim().replace(/,+$/, "").trim();
      if (extra && !finalInterests.includes(extra)) finalInterests.push(extra);
    }

    try {
      const res = await userAPI.updateProfile({
        bio,
        interests: JSON.stringify(finalInterests),
      });
      updateUser(res.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
    >
      <div
        className="card animate-scale-in"
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "var(--space-6)",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>Welcome to Synco! 🎉</h2>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Let's set up your profile so others can get to know you better.
          </p>
        </div>

        {error && (
          <div className="toast toast--error" style={{ position: "relative", marginBottom: "var(--space-4)" }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="input-group">
            <label className="input-label">A short bio</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Hi! I love playing basketball and trying new coffee shops..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">
              Your Interests{" "}
              <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: "var(--text-xs)" }}>
                — type a tag and press Enter or comma to add
              </span>
            </label>

            {/* Tag chips */}
            <div
              className="input"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                minHeight: "46px",
                alignItems: "center",
                cursor: "text",
                padding: "8px 12px",
              }}
              onClick={() => document.getElementById("tag-input-onboarding").focus()}
            >
              {interests.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "var(--color-primary)",
                    color: "#fff",
                    borderRadius: "var(--radius-full)",
                    padding: "3px 10px",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                  }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                id="tag-input-onboarding"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={interests.length === 0 ? "Basketball, Coffee, Reading..." : "Add more..."}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  flex: 1,
                  minWidth: "120px",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              Skip
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
              style={{ flex: 2 }}
            >
              {loading ? <span className="spinner" /> : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OnboardingModal;
