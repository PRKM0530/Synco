import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authAPI } from "../../services/api";
import SyncoLogo from "../../components/common/SyncoLogo";
import { useAuth } from "../../context/AuthContext";
import { AlertTriangle, Mail } from "lucide-react";

const VerifyOTPPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, verifyEmail: contextVerifyEmail } = useAuth();
  
  // We expect email to be passed in state from register/login plugin or via context
  const email = location.state?.email || user?.email || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await contextVerifyEmail({ email, otp });
      navigate("/");
    } catch (err) {
      setError(
        err.message || "Failed to verify. Please check your OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError("");
    setSuccess("");
    try {
      await authAPI.resendOtp({ email });
      setSuccess("A new OTP has been sent to your email.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card card--glass animate-scale-in">
        <div className="auth-header">
          <SyncoLogo size={64} className="auth-logo" />
          <h1 className="auth-heading gradient-text">Verify Email</h1>
          <p className="auth-subheading">
            Enter the 6-digit code sent to {email}
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

        {success && (
          <div
            className="toast toast--success"
            style={{
              position: "relative",
              top: 0,
              marginBottom: "var(--space-4)",
            }}
          >
            <Mail size={16} /> {success}
          </div>
        )}



        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="verify-otp" className="input-label">
              One-Time Password
            </label>
            <input
              id="verify-otp"
              type="text"
              name="otp"
              className="input"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
              style={{ fontSize: "1.5rem", letterSpacing: "4px", textAlign: "center" }}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--full"
            disabled={loading || otp.length < 6}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Verifying..." : "Verify Account"}
          </button>
        </form>

        <div style={{ marginTop: "var(--space-4)", textAlign: "center", fontSize: "0.9rem" }}>
          <span style={{ color: "var(--color-text-muted)" }}>Didn't receive the code?</span>{" "}
          <button 
            type="button" 
            onClick={handleResend} 
            disabled={resending || !email}
            style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: "600", cursor: "pointer", padding: 0 }}
          >
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTPPage;
