import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { activityAPI } from "../../services/api";
import ActivityCard from "../../components/activity/ActivityCard";
import CategoryIcon from "../../components/common/CategoryIcon";
import SyncoLogo from "../../components/common/SyncoLogo";
import { CATEGORIES } from "../../utils/categories";
import { Search, Sparkles, SlidersHorizontal } from "lucide-react";
import FloatingActionButton from "../../components/layout/FloatingActionButton";

const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fetchActivities = async (loc) => {
      setLoading(true);
      try {
        const params = loc ? { lat: loc.lat, lng: loc.lng, radius: 999 } : {};
        if (categoryFilter) params.category = categoryFilter;
        if (debouncedSearch) params.search = debouncedSearch;
        if (dateFilter) params.date = dateFilter;
        params.visibility = "PUBLIC";

        const res = await activityAPI.getActivities(params);
        setActivities(res.data.activities || []);
      } catch (err) {
        console.error("Failed to fetch explore activities", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchActivities({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      );
    }
  }, [categoryFilter, debouncedSearch, dateFilter]);

  const handleCategoryClick = (catLabel) => {
    if (categoryFilter === catLabel) {
      setSearchParams({});
    } else {
      setSearchParams({ category: catLabel });
    }
  };

  return (
    <div className="page-content">
      <FloatingActionButton />
      <div className="animate-fade-in-up" style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="page-title" style={{ fontSize: "var(--text-3xl)" }}>
          Explore
        </h1>
        <p className="page-subtitle" style={{ fontSize: "var(--text-base)" }}>
          Browse activities by category or search for something specific
        </p>
      </div>

      {/* Search + Filter Toggle */}
      <div className="animate-fade-in-up" style={{ animationDelay: "100ms", marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
            <input
              type="text"
              className="input"
              placeholder="Search activities, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "36px", width: "100%", margin: 0, height: "44px" }}
            />
          </div>
          <button
            className={`btn ${showFilters ? "btn--primary" : "btn--secondary"} btn--sm`}
            onClick={() => setShowFilters((p) => !p)}
            style={{ height: "44px", padding: "0 var(--space-3)", flexShrink: 0 }}
            title="Toggle filters"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {showFilters && (
          <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <input
              type="date"
              className="input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ flex: "1 1 180px", margin: 0, height: "40px", paddingLeft: "12px" }}
            />
            {(categoryFilter || dateFilter) && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { setSearchParams({}); setDateFilter(""); }}
                style={{ height: "40px" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Categories Grid */}
      <div className="animate-fade-in-up" style={{ animationDelay: "200ms", marginBottom: "var(--space-8)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
          Categories
        </h2>
        <div className="explore-categories-grid">
          {CATEGORIES.map((catLabel) => {
            const isActive = categoryFilter === catLabel;
            return (
              <button
                key={catLabel}
                onClick={() => handleCategoryClick(catLabel)}
                className={`explore-category-card ${isActive ? "explore-category-card--active" : ""}`}
              >
                <div className="explore-category-icon">
                  <CategoryIcon category={catLabel} size={26} />
                </div>
                <span className="explore-category-label">{catLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
            {categoryFilter ? `${categoryFilter} Activities` : "All Activities"}
          </h2>
          {!loading && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              {activities.length} result{activities.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading && activities.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-8)" }}>
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></span>
          </div>
        ) : activities.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><SyncoLogo size={64} /></div>
            <h3 className="empty-state-title">No activities found</h3>
            <p className="empty-state-text">
              {categoryFilter
                ? `No ${categoryFilter} activities available right now.`
                : "No activities match your search. Try different keywords or filters."}
            </p>
            {categoryFilter && (
              <button className="btn btn--secondary btn--sm" onClick={() => setSearchParams({})} style={{ marginTop: "var(--space-4)" }}>
                <Sparkles size={14} /> Show All
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;
