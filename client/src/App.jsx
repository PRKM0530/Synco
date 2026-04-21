import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/layout/Navbar";
import BottomNav from "./components/layout/BottomNav";
import ErrorBoundary from "./components/ErrorBoundary";
import { userAPI } from "./services/api";

// PERFORMANCE: Lazy-load ALL pages for code-splitting.
// Only the code for the current route is downloaded on navigation.
// Previously 15+ pages were eagerly bundled into one massive JS file.

// Auth pages
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const VerifyOTPPage = lazy(() => import("./pages/auth/VerifyOTPPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));

// Main pages
const HomePage = lazy(() => import("./pages/home/HomePage"));
const MapPage = lazy(() => import("./pages/home/MapPage"));
const ExplorePage = lazy(() => import("./pages/explore/ExplorePage"));

// Profile pages
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));
const EditProfilePage = lazy(() => import("./pages/profile/EditProfilePage"));

// Activity pages
const CreateActivityPage = lazy(() => import("./pages/activity/CreateActivityPage"));
const EditActivityPage = lazy(() => import("./pages/activity/EditActivityPage"));
const ActivityDetailPage = lazy(() => import("./pages/activity/ActivityDetailPage"));
const VerifyAttendancePage = lazy(() => import("./pages/activity/VerifyAttendancePage"));
const HostRosterPage = lazy(() => import("./pages/activity/HostRosterPage"));

// Social pages
const FriendsPage = lazy(() => import("./pages/friends/FriendsPage"));
const NotificationsPage = lazy(() => import("./pages/notifications/NotificationsPage"));
const ChatInboxPage = lazy(() => import("./pages/chat/ChatInboxPage"));
const DirectMessagePage = lazy(() => import("./pages/chat/DirectMessagePage"));

// Admin
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="spinner"
          style={{ width: 32, height: 32, borderWidth: 3 }}
        />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.isVerified) return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  
  return children;
};

// Admin-only route — requires ADMIN role
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="spinner" />
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
};

// Guest-only route (redirect to home if logged in)
const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

const AppContent = () => {
  const { isAuthenticated } = useAuth();

  // Keep user location updated for nearby SOS matching.
  useEffect(() => {
    if (!isAuthenticated || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await userAPI.updateProfile({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        } catch (err) {
          console.warn("Location sync failed:", err?.message || err);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 },
    );
  }, [isAuthenticated]);

  return (
    <>
      <Navbar />
      <div className="page-shell">
        <Suspense fallback={<div style={{display:"flex",justifyContent:"center",marginTop:"100px"}}><span className="spinner" style={{width:40,height:40,borderWidth:4}}></span></div>}>
        <Routes>
          {/* Auth routes — guest only */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route
            path="/verify-email"
            element={
              <VerifyOTPPage />
            }
          />
          <Route
            path="/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <GuestRoute>
                <ResetPasswordPage />
              </GuestRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:id?"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Activity routes */}
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <MapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/explore"
            element={
              <ProtectedRoute>
                <ExplorePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/create"
            element={
              <ProtectedRoute>
                <CreateActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/:id"
            element={
              <ProtectedRoute>
                <ActivityDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/:id/edit"
            element={
              <ProtectedRoute>
                <EditActivityPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatInboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:friendId"
            element={
              <ProtectedRoute>
                <DirectMessagePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/:id/verify"
            element={
              <ProtectedRoute>
                <VerifyAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/:id/roster"
            element={
              <ProtectedRoute>
                <HostRosterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          {/* 404 fallback */}
          <Route
            path="*"
            element={
              <div className="page-content empty-state">
                <div className="empty-state-icon">🔍</div>
                <h3 className="empty-state-title">Page not found</h3>
                <p className="empty-state-text">
                  The page you're looking for doesn't exist.
                </p>
              </div>
            }
          />
        </Routes>
        </Suspense>
      </div>
      <BottomNav />
    </>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
