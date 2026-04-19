import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { activityAPI } from "../../services/api";
import ActivityCard from "../../components/activity/ActivityCard";
import SyncoLogo from "../../components/common/SyncoLogo";
import OnboardingModal from "../../components/profile/OnboardingModal";

import { Sparkles, Search, Calendar, Users } from "lucide-react";
import FloatingActionButton from "../../components/layout/FloatingActionButton";

const TABS = [
  { key: "foryou", label: "For You" },
  { key: "myactivity", label: "Your Activity" },
];

const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("foryou");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // For You state
  const [nearbyActivities, setNearbyActivities] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("PUBLIC");

  // Your Activity state
  const [hostedActivities, setHostedActivities] = useState([]);
  const [joinedActivities, setJoinedActivities] = useState([]);
  const [myLoading, setMyLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Onboarding check
  useEffect(() => {
    if (!user) return;
    const hasInterests = user.interests && user.interests.length > 0;
    const dismissed = localStorage.getItem(`synco_onboarding_dismissed_${user.id}`);
    if (!hasInterests && !dismissed) setShowOnboarding(true);
  }, [user]);

  const handleCloseOnboarding = () => {
    localStorage.setItem(`synco_onboarding_dismissed_${user?.id}`, "1");
    setShowOnboarding(false);
  };

  // Fetch nearby activities for "For You"
  useEffect(() => {
    if (activeTab !== "foryou") return;

    const fetchNearby = (loc) => {
      setNearbyLoading(true);
      const params = loc ? { lat: loc.lat, lng: loc.lng, radius: 50 } : {};
      if (debouncedSearchQuery) params.search = debouncedSearchQuery;
      if (dateFilter) params.date = dateFilter;
      if (visibilityFilter) params.visibility = visibilityFilter;

      activityAPI.getActivities(params)
        .then((res) => setNearbyActivities(res.data.activities))
        .catch((err) => console.error("Failed to fetch activities", err))
        .finally(() => setNearbyLoading(false));
    };

    // Load immediately, then re-fetch with location
    fetchNearby(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchNearby({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      );
    }
  }, [activeTab, debouncedSearchQuery, dateFilter, visibilityFilter]);

  // Fetch user's activities for "Your Activity"
  useEffect(() => {
    if (activeTab !== "myactivity") return;
    setMyLoading(true);
    activityAPI.getMyActivities()
      .then((res) => {
        setHostedActivities(res.data.hosted || []);
        setJoinedActivities(res.data.joined || []);
      })
      .catch((err) => console.error("Failed to fetch my activities", err))
      .finally(() => setMyLoading(false));
  }, [activeTab]);

  return (
    <div className="page-content">
      <FloatingActionButton />
      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} userId={user?.id} />}

      {/* Welcome Section */}
      <div className="animate-fade-in-up" style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="page-title" style={{ fontSize: "var(--text-3xl)" }}>
          Hey,{" "}
          <span className="gradient-text">
            {user?.displayName?.split(" ")[0] || "there"}
          </span>!
        </h1>
        <p className="page-subtitle" style={{ fontSize: "var(--text-base)" }}>
          Discover people nearby and do things together
        </p>
      </div>

      {/* Tab Bar */}
      <div className="home-tabs animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`home-tab ${activeTab === tab.key ? "home-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── FOR YOU TAB ─── */}
      {activeTab === "foryou" && (
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", background: "var(--color-surface)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: "var(--space-6)" }}>
            <div style={{ flex: "1 1 200px", position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="text"
                className="input"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "36px", width: "100%", margin: 0, height: "40px", color: "var(--color-text-primary)" }}
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <input
                type="date"
                className="input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ width: "100%", margin: 0, height: "40px", paddingLeft: "12px", color: "var(--color-text-primary)" }}
              />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <select
                className="input"
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value)}
                style={{ width: "100%", margin: 0, height: "42px", color: "var(--color-text-primary)", padding: "var(--space-2) var(--space-3)" }}
              >
                <option value="PUBLIC">Public</option>
                <option value="FRIENDS">Friends Only</option>
              </select>
            </div>
          </div>

          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
            Nearby Activities
          </h2>

          {nearbyLoading && nearbyActivities.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-8)" }}>
              <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></span>
            </div>
          ) : nearbyActivities.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", opacity: nearbyLoading ? 0.6 : 1, transition: "opacity 0.2s" }}>
              {nearbyActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><SyncoLogo size={64} /></div>
              <h3 className="empty-state-title">No activities found</h3>
              <p className="empty-state-text">Be the first to create an activity! Or check back soon.</p>
              <Link to="/activities/create" className="btn btn--primary" style={{ marginTop: "var(--space-4)" }}>
                <Sparkles size={16} /> Create Activity
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ─── YOUR ACTIVITY TAB ─── */}
      {activeTab === "myactivity" && (
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          {myLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-8)" }}>
              <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></span>
            </div>
          ) : (
            <>
              {/* Hosted */}
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Sparkles size={18} /> Created by You
              </h2>
              {hostedActivities.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
                  {hostedActivities.map((a) => <ActivityCard key={a.id} activity={a} />)}
                </div>
              ) : (
                <div className="empty-state" style={{ marginBottom: "var(--space-8)", padding: "var(--space-6)" }}>
                  <p className="empty-state-text">You haven't created any activities yet.</p>
                  <Link to="/activities/create" className="btn btn--primary btn--sm" style={{ marginTop: "var(--space-3)" }}>
                    <Sparkles size={14} /> Create One
                  </Link>
                </div>
              )}

              {/* Joined */}
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Users size={18} /> Joined
              </h2>
              {joinedActivities.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {joinedActivities.map((a) => <ActivityCard key={a.id} activity={a} />)}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "var(--space-6)" }}>
                  <p className="empty-state-text">You haven't joined any activities yet. Explore and find something fun!</p>
                  <Link to="/explore" className="btn btn--secondary btn--sm" style={{ marginTop: "var(--space-3)" }}>
                    Explore Activities
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HomePage;
