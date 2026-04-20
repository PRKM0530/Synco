import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { activityAPI } from "../../services/api";
import MapPicker from "../../components/activity/MapPicker";

import { CATEGORIES } from "../../utils/categories";

const CreateActivityPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    date: "",
    time: "",
    duration: "",
    maxParticipants: 5,
    visibility: "PUBLIC",
    address: "",
    tags: [],
  });

  const [location, setLocation] = useState(null);
  const [tagInput, setTagInput] = useState("");

  const handleChange = (e) => {
    setError("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLocationSelect = (loc) => {
    // loc is [lat, lng] array from MapPicker
    setLocation(loc);
  };

  const handleAddressChange = (addr) => {
    // Auto-fill address field when user picks from autocomplete
    if (addr) {
      setForm((prev) => ({ ...prev, address: addr }));
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !form.tags.includes(newTag) && form.tags.length < 5) {
        setForm((prev) => ({ ...prev, tags: [...prev.tags, newTag] }));
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && form.tags.length > 0) {
      setForm((prev) => ({ ...prev, tags: prev.tags.slice(0, -1) }));
    }
  };

  const removeTag = (tagToRemove) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !form.title ||
      !form.category ||
      !form.date ||
      !form.time ||
      !form.address
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!location) {
      setError("Please pin a location on the map.");
      return;
    }

    // Combine date and time
    const dateTime = new Date(`${form.date}T${form.time}`).toISOString();

    // Guard: reject if the activity would start in the past
    if (new Date(dateTime) <= new Date()) {
      setError("Activity date and time must be in the future.");
      return;
    }

    setLoading(true);
    try {
      const activityData = {
        title: form.title,
        category: form.category,
        description: form.description,
        latitude: Array.isArray(location) ? location[0] : location.lat,
        longitude: Array.isArray(location) ? location[1] : location.lng,
        address: form.address,
        date: dateTime,
        duration: form.duration ? parseInt(form.duration) : null,
        maxParticipants: parseInt(form.maxParticipants),
        visibility: form.visibility,
        tags: JSON.stringify(form.tags),
      };

      const res = await activityAPI.createActivity(activityData);
      navigate(`/activities/${res.data.activity.id}`);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.errors?.[0]?.msg ||
          "Failed to create activity.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header" style={{ textAlign: "center" }}>
        <h1 className="page-title">Create Activity</h1>
        <p className="page-subtitle">Plan something fun and invite others</p>
      </div>

      {error && (
        <div
          className="toast toast--error"
          style={{
            position: "relative",
            top: 0,
            marginBottom: "var(--space-6)",
            maxWidth: "600px",
            margin: "0 auto var(--space-4)",
          }}
        >
          <span></span> {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Basic Info */}
        <div className="card">
          <h2
            style={{
              fontSize: "var(--text-lg)",
              marginBottom: "var(--space-4)",
            }}
          >
            Basic Info
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div className="input-group">
              <label className="input-label">Title *</label>
              <input
                type="text"
                name="title"
                className="input"
                placeholder="e.g. Weekend Basketball Game"
                value={form.title}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={100}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Category *</label>
              <select
                name="category"
                className="input"
                value={form.category}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Select a category
                </option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Description</label>
              <textarea
                name="description"
                className="input"
                placeholder="Any details participants should know?"
                value={form.description}
                onChange={handleChange}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Tags ({form.tags.length}/5)</label>
              <div
                className="interests-input"
                style={{ padding: "var(--space-2)" }}
              >
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="tag tag--active"
                    onClick={() => removeTag(tag)}
                    style={{ cursor: "pointer" }}
                  >
                    {tag} ×
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Type tag & hit Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  disabled={form.tags.length >= 5}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Location & Time */}
        <div className="card">
          <h2
            style={{
              fontSize: "var(--text-lg)",
              marginBottom: "var(--space-4)",
            }}
          >
            Where & When
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", gap: "var(--space-4)" }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Date *</label>
                <input
                  type="date"
                  name="date"
                  className="input"
                  value={form.date}
                  onChange={handleChange}
                  min={new Date().toISOString().split("T")[0]}
                  max="2099-12-31"
                  required
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Time *</label>
                <input
                  type="time"
                  name="time"
                  className="input"
                  value={form.time}
                  onChange={handleChange}
                  min={
                    // If selected date is today, time must be at least now (+5 min buffer)
                    form.date === new Date().toISOString().split("T")[0]
                      ? new Date(Date.now() + 5 * 60000).toTimeString().slice(0, 5)
                      : undefined
                  }
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Estimated Duration (mins)</label>
              <input
                type="number"
                name="duration"
                className="input"
                placeholder="e.g. 90"
                value={form.duration}
                onChange={handleChange}
                min={1}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Address / Venue Name *</label>
              <input
                type="text"
                name="address"
                className="input"
                placeholder="e.g. Central Park Courts"
                value={form.address}
                onChange={handleChange}
                autoComplete="off"
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Pin on Map *</label>
              <MapPicker
                onLocationSelect={handleLocationSelect}
              />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="card">
          <h2
            style={{
              fontSize: "var(--text-lg)",
              marginBottom: "var(--space-4)",
            }}
          >
            Settings
          </h2>
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Max Participants *</label>
              <input
                type="number"
                name="maxParticipants"
                className="input"
                value={form.maxParticipants}
                onChange={handleChange}
                required
                min={2}
                max={100}
              />
            </div>

            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Visibility</label>
              <select
                name="visibility"
                className="input"
                value={form.visibility}
                onChange={handleChange}
              >
                <option value="PUBLIC">Public — Anyone can join</option>
                <option value="FRIENDS">Friends Only</option>
              </select>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            marginTop: "var(--space-2)",
          }}
        >
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            style={{ flex: 1 }}
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary btn--lg"
            style={{ flex: 2 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Creating..." : "Create Activity"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateActivityPage;
