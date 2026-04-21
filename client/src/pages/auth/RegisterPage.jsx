import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SyncoLogo from "../../components/common/SyncoLogo";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, error, clearError } = useAuth();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedDataUse, setAcceptedDataUse] = useState(false);

  const handleChange = (e) => {
    clearError();
    setLocalError("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    if (form.password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    if (!acceptedDataUse) {
      setLocalError("Please accept the data usage notice to continue.");
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        displayName: form.displayName,
        email: form.email,
        password: form.password,
      });
      if (res?.pendingVerification) {
        navigate("/verify-email", { state: { email: form.email } });
      }
    } catch {
      // Error handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-card card card--glass animate-scale-in">
        <div className="auth-header">
          <SyncoLogo size={64} className="auth-logo" />
          <h1 className="auth-heading gradient-text">Join Synco</h1>
          <p className="auth-subheading">
            Discover people. Do things together.
          </p>
        </div>

        {displayError && (
          <div
            className="toast toast--error"
            style={{
              position: "relative",
              top: 0,
              marginBottom: "var(--space-4)",
            }}
          >
            <AlertTriangle size={16} /> {displayError}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="register-name" className="input-label">
              Display Name
            </label>
            <input
              id="register-name"
              type="text"
              name="displayName"
              className="input"
              placeholder="Your name"
              value={form.displayName}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={50}
              autoComplete="name"
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-email" className="input-label">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              name="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-password" className="input-label">
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                name="password"
                className="input"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-muted)"
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="register-confirm" className="input-label">
              Confirm Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="register-confirm"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="input"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-muted)"
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label
            htmlFor="register-consent"
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "flex-start",
              fontSize: "12px",
              color: "var(--color-text-muted)",
              marginTop: "-4px",
            }}
          >
            <input
              id="register-consent"
              type="checkbox"
              checked={acceptedDataUse}
              onChange={(e) => {
                setAcceptedDataUse(e.target.checked);
                if (e.target.checked) setLocalError("");
              }}
              style={{ marginTop: "2px" }}
            />
            <span>
              This app uses your location to show nearby activities and your email for login, verification, and important account updates.
            </span>
          </label>

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--full"
            disabled={loading}
            id="register-submit"
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
