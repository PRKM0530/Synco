import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { activityAPI } from "../../services/api";
import ActivityCard from "../../components/activity/ActivityCard";
import SyncoLogo from "../../components/common/SyncoLogo";
import OnboardingModal from "../../components/profile/OnboardingModal";
import CategoryIcon from "../../components/common/CategoryIcon";
import { CATEGORIES } from "../../utils/categories";

import { Sparkles, Map, Search, Calendar, Users, Globe } from "lucide-react";

const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Advanced Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("PUBLIC"); // PUBLIC, FRIENDS

  // Debounce search query to prevent flickering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!user) return;
    // Show onboarding if the user has never set their interests
    // (interests array empty = brand new account)
    const hasInterests = user.interests && user.interests.length > 0;
    const dismissed = localStorage.getItem(`synco_onboarding_dismissed_${user.id}`);
    if (!hasInterests && !dismissed) {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleCloseOnboarding = () => {
    // Use user-specific key so new accounts always see the popup
    localStorage.setItem(`synco_onboarding_dismissed_${user?.id}`, "1");
    setShowOnboarding(false);
  };

  useEffect(() => {
    // 1️⃣ Fetch activities immediately (no location wait)
    fetchActivities(null, categoryFilter, debouncedSearchQuery, dateFilter, visibilityFilter);

    // 2️⃣ Try to get location in parallel — re-fetch with radius if granted
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          fetchActivities(loc, categoryFilter, debouncedSearchQuery, dateFilter, visibilityFilter);
        },
        () => { /* No location — keep the already-loaded activities */ },
        { timeout: 5000 },
      );
    }
  }, [categoryFilter, debouncedSearchQuery, dateFilter, visibilityFilter]);

  const fetchActivities = async (loc, cat, search, date, vis) => {
    setLoading(true);
    try {
      const params = loc ? { lat: loc.lat, lng: loc.lng, radius: 50 } : {};
      if (cat) params.category = cat;
      if (search) params.search = search;
      if (date) params.date = date;
      if (vis) params.visibility = vis;

      const res = await activityAPI.getActivities(params);
      setActivities(res.data.activities);
    } catch (err) {
      console.error("Failed to fetch activities", err);
    } finally {
      setLoading(false);
    }
  };


  const handleCategoryClick = (catLabel) => {
    if (categoryFilter === catLabel) {
      setSearchParams({});
    } else {
      setSearchParams({ category: catLabel });
    }
  };

  return (
    <div className="page-content">
      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} userId={user?.id} />}
      {/* Welcome Section */}
      <div
        className="animate-fade-in-up"
        style={{ marginBottom: "var(--space-8)" }}
      >
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

      {/* Quick Actions */}
      <div
        className="animate-fade-in-up"
        style={{ animationDelay: "100ms", marginBottom: "var(--space-8)" }}
      >
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <Link
            to="/activities/create"
            className="btn btn--primary btn--lg"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Sparkles size={20} /> Create Activity
          </Link>
          <Link
            to="/map"
            className="btn btn--secondary btn--lg"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Map size={20} /> Map View
          </Link>
        </div>
      </div>

      {/* Categories */}
      <div
        className="animate-fade-in-up"
        style={{ animationDelay: "200ms", marginBottom: "var(--space-8)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-4)",
          }}
        >
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
            Browse by Category
          </h2>
          {categoryFilter && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setSearchParams({})}
            >
              <Sparkles size={16} /> Clear Category
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "var(--space-3)",
          }}
        >
          {CATEGORIES.map((catLabel) => {
            const isActive = categoryFilter === catLabel;
            return (
              <button
                key={catLabel}
                onClick={() => handleCategoryClick(catLabel)}
                className={`card card--hover ${isActive ? "active" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-4) var(--space-2)",
                  cursor: "pointer",
                  textAlign: "center",
                  border: isActive
                    ? "1px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                  background: isActive
                    ? "rgba(108, 92, 231, 0.1)"
                    : "var(--color-surface)",
                }}
              >
                <div style={{ color: isActive ? "var(--color-primary-light)" : "var(--color-text-secondary)" }}>
                  <CategoryIcon category={catLabel} size={28} />
                </div>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: isActive
                      ? "var(--color-primary-light)"
                      : "var(--color-text-secondary)",
                  }}
                >
                  {catLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            marginBottom: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
              {categoryFilter ? `${categoryFilter} Nearby` : "Nearby Activities"}
            </h2>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigate("/map")}
            >
              See Map →
            </button>
          </div>
          
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", background: "var(--color-surface)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
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
            <div style={{ flex: "1 1 150px", position: "relative" }}>
               <input 
                 type="date"
                 className="input"
                 value={dateFilter}
                 onChange={(e) => setDateFilter(e.target.value)}
                 style={{ width: "100%", margin: 0, height: "40px", paddingLeft: "12px", color: "var(--color-text-primary)" }}
               />
            </div>
            <div style={{ flex: "1 1 120px", display: "flex" }}>
               <select 
                 className="input" 
                 value={visibilityFilter} 
                 onChange={(e) => setVisibilityFilter(e.target.value)}
                 style={{ width: "100%", margin: 0, height: "42px", color: "var(--color-text-primary)", padding: "var(--space-2) var(--space-3)", display: "block", lineHeight: "1" }}
               >
               <option value="PUBLIC">Public</option>
                 <option value="FRIENDS">Friends Only</option>
               </select>
            </div>
          </div>
        </div>

        {loading && activities.length === 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "var(--space-8)",
            }}
          >
            <span
              className="spinner"
              style={{ width: 32, height: 32, borderWidth: 3 }}
            ></span>
          </div>
        ) : activities.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 0.2s"
            }}
          >
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <SyncoLogo size={64} />
            </div>
            <h3 className="empty-state-title">No activities found</h3>
            <p className="empty-state-text">
              {categoryFilter
                ? `No ${categoryFilter} activities found within 15km.`
                : "Be the first to create an activity! Or check back soon."}
            </p>
            <Link
              to="/activities/create"
              className="btn btn--primary"
              style={{ marginTop: "var(--space-4)" }}
            >
              <Sparkles size={16} /> Create Activity
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
