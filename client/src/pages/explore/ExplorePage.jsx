import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { activityAPI } from "../../services/api";
import ActivityCard from "../../components/activity/ActivityCard";
import CategoryIcon from "../../components/common/CategoryIcon";
import SyncoLogo from "../../components/common/SyncoLogo";
import { CATEGORIES } from "../../utils/categories";
import { Search, Sparkles } from "lucide-react";
import FloatingActionButton from "../../components/layout/FloatingActionButton";

const EXPLORE_PAGE_SIZE = 10;

const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("PUBLIC");
  const locationRef = useRef(null);
  const queryVersionRef = useRef(0);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchExploreActivities = async ({ reset = false, locationOverride, queryVersion } = {}) => {
    const version = queryVersion ?? queryVersionRef.current;
    const effectiveLocation = locationOverride !== undefined ? locationOverride : locationRef.current;
    const nextOffset = reset ? 0 : offset;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = effectiveLocation
        ? { lat: effectiveLocation.lat, lng: effectiveLocation.lng, radius: 50 }
        : {};

      if (categoryFilter) params.category = categoryFilter;
      if (debouncedSearchQuery) params.search = debouncedSearchQuery;
      if (dateFilter) params.date = dateFilter;
      if (visibilityFilter) params.visibility = visibilityFilter;
      params.offset = nextOffset;
      params.limit = EXPLORE_PAGE_SIZE;

      const res = await activityAPI.getActivities(params);
      if (version !== queryVersionRef.current) return;

      const fetched = res.data.activities || [];
      setActivities((prev) => {
        if (reset) return fetched;
        const merged = new Map(prev.map((item) => [item.id, item]));
        fetched.forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values());
      });

      const consumed = nextOffset + fetched.length;
      setOffset(consumed);
      setHasMore(Boolean(res.data.hasMore));
    } catch (err) {
      console.error("Failed to fetch explore activities", err);
      if (reset) {
        setActivities([]);
        setHasMore(false);
      }
    } finally {
      if (version === queryVersionRef.current) {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const queryVersion = queryVersionRef.current + 1;
    queryVersionRef.current = queryVersion;
    locationRef.current = null;
    setOffset(0);
    setHasMore(false);

    fetchExploreActivities({ reset: true, locationOverride: null, queryVersion });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || queryVersion !== queryVersionRef.current) return;
          const nextLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          locationRef.current = nextLocation;
          fetchExploreActivities({ reset: true, locationOverride: nextLocation, queryVersion });
        },
        () => {},
        { timeout: 5000 },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [categoryFilter, debouncedSearchQuery, dateFilter, visibilityFilter]);

  const loadMoreExploreActivities = () => {
    if (loading || loadingMore || !hasMore) return;
    fetchExploreActivities({ reset: false });
  };

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreExploreActivities();
        }
      },
      { rootMargin: "220px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, offset]);

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

      {/* Filters */}
      <div className="animate-fade-in-up" style={{ animationDelay: "100ms", marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", background: "var(--color-surface)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
            <input
              type="text"
              className="input"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "36px", width: "100%", margin: 0, height: "40px" }}
            />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <input
              type="date"
              className="input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: "100%", margin: 0, height: "40px", paddingLeft: "12px" }}
            />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <select
              className="input"
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              style={{ width: "100%", margin: 0, height: "42px", padding: "var(--space-2) var(--space-3)" }}
            >
              <option value="PUBLIC">Public</option>
              <option value="FRIENDS">Friends Only</option>
            </select>
          </div>
          {(categoryFilter || dateFilter || visibilityFilter !== "PUBLIC" || debouncedSearchQuery) && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setSearchParams({});
                setSearchQuery("");
                setDateFilter("");
                setVisibilityFilter("PUBLIC");
              }}
              style={{ height: "40px" }}
            >
              Clear Filters
            </button>
          )}
        </div>
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
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
              {activities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>

            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-5)" }}>
                <div ref={loadMoreRef} style={{ width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
                <button
                  className="btn btn--secondary"
                  onClick={loadMoreExploreActivities}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading more..." : "Load More Activities"}
                </button>
              </div>
            )}
          </>
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
