import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SyncoLogo from "../../components/common/SyncoLogo";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, error, clearError } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    clearError();
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      navigate("/");
    } catch {
      // Error is handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card card--glass animate-scale-in">
        <div className="auth-header">
          <SyncoLogo size={64} className="auth-logo" />
          <h1 className="auth-heading gradient-text">Welcome back</h1>
          <p className="auth-subheading">
            Sign in to find people and do things together
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
            <label htmlFor="login-email" className="input-label">
              Email
            </label>
            <input
              id="login-email"
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
            <label htmlFor="login-password" className="input-label">
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                className="input"
                
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
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
          
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)", marginTop: "-var(--space-2)" }}>
            <Link to="/forgot-password" style={{ fontSize: "var(--text-sm)", color: "var(--color-primary-light)", textDecoration: "none", fontWeight: "600" }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--full"
            disabled={loading}
            id="login-submit"
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
