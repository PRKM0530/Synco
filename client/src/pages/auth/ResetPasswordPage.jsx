import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { authAPI } from "../../services/api";
import SyncoLogo from "../../components/common/SyncoLogo";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  const [form, setForm] = useState({ otp: "", newPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Email address is missing. Please restart the reset process.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await authAPI.resetPassword({ email, otp: form.otp, newPassword: form.newPassword });
      alert("Password reset successfully. Please sign in with your new password.");
      navigate("/login");
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to reset password. Please check your code."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card card--glass animate-scale-in">
        <div className="auth-header">
          <SyncoLogo size={64} className="auth-logo" />
          <h1 className="auth-heading gradient-text">New Password</h1>
          <p className="auth-subheading">
            Enter the 6-digit code sent to {email || "your email"}
          </p>
        </div>

        {error && (
          <div
            className="toast toast--error"
            style={{
              position: "relative",
              top: 0,
              marginBottom: "var(--space-4)",
            }}
          >
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="reset-otp" className="input-label">
              Reset Code
            </label>
            <input
              id="reset-otp"
              type="text"
              name="otp"
              className="input"
              placeholder="Enter 6-digit code"
              value={form.otp}
              onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              required
              minLength={6}
              maxLength={6}
              style={{ fontSize: "1.5rem", letterSpacing: "4px", textAlign: "center" }}
            />
          </div>

          <div className="input-group">
            <label htmlFor="reset-new-password" className="input-label">
              New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="reset-new-password"
                type={showPassword ? "text" : "password"}
                name="newPassword"
                className="input"
                placeholder="••••••••"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                minLength={6}
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

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--full"
            disabled={loading || form.otp.length < 6 || form.newPassword.length < 6}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Resetting..." : "Save New Password"}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/forgot-password">Go back</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
