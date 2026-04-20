import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../../services/api";
import SyncoLogo from "../../components/common/SyncoLogo";
import { AlertTriangle, Mail } from "lucide-react";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    try {
      await authAPI.forgotPassword({ email });
      // Redirect to reset password page and pass email along
      navigate("/reset-password", { state: { email } });
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to send reset code. Please try again."
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
          <h1 className="auth-heading gradient-text">Reset Password</h1>
          <p className="auth-subheading">
            Enter your email to receive a password reset code.
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
            <label htmlFor="reset-email" className="input-label">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              name="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--full"
            disabled={loading || !email}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Sending..." : "Send Reset Code"}
          </button>
        </form>

        <div className="auth-footer">
          Remember your password? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
