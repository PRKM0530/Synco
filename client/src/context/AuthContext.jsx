import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user on mount
  useEffect(() => {
    const token = localStorage.getItem("synco_token");
    const savedUser = localStorage.getItem("synco_user");

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("synco_user");
      }
      // Verify token is still valid
      authAPI
        .getMe()
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem("synco_user", JSON.stringify(res.data.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async ({ email, password, displayName }) => {
    setError(null);
    try {
      const res = await authAPI.register({ email, password, displayName });
      const { token, user: userData } = res.data;
      localStorage.setItem("synco_token", token);
      localStorage.setItem("synco_user", JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        "Registration failed.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setError(null);
    try {
      const res = await authAPI.login({ email, password });
      const { token, user: userData } = res.data;
      localStorage.setItem("synco_token", token);
      localStorage.setItem("synco_user", JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      const message = err.response?.data?.error || "Login failed.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("synco_token");
    localStorage.removeItem("synco_user");
    setUser(null);
    setError(null);
  }, []);

  const updateUser = useCallback((updatedData) => {
    setUser((prev) => {
      const updated = { ...prev, ...updatedData };
      localStorage.setItem("synco_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    updateUser,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
