import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { activityAPI, sosAPI } from "../../services/api";
import ActivityCard from "../../components/activity/ActivityCard";
import SyncoLogo from "../../components/common/SyncoLogo";
import OnboardingModal from "../../components/profile/OnboardingModal";

import { Sparkles, Search, Users, AlertTriangle, Bell } from "lucide-react";
import FloatingActionButton from "../../components/layout/FloatingActionButton";

const FOR_YOU_PAGE_SIZE = 10;

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
  const [nearbyLoadingMore, setNearbyLoadingMore] = useState(false);
  const [nearbyOffset, setNearbyOffset] = useState(0);
  const [nearbyHasMore, setNearbyHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("PUBLIC");
  const nearbyLocationRef = useRef(null);
  const nearbyQueryVersionRef = useRef(0);
  const nearbyLoadedRef = useRef(false);
  const nearbyCacheKeyRef = useRef("");
  const nearbyLoadMoreRef = useRef(null);

  // Your Activity state
  const [hostedActivities, setHostedActivities] = useState([]);
  const [joinedActivities, setJoinedActivities] = useState([]);
  const [hostedOffset, setHostedOffset] = useState(0);
  const [hostedHasMore, setHostedHasMore] = useState(false);
  const [hostedLoadingMore, setHostedLoadingMore] = useState(false);
  const [joinedOffset, setJoinedOffset] = useState(0);
  const [joinedHasMore, setJoinedHasMore] = useState(false);
  const [joinedLoadingMore, setJoinedLoadingMore] = useState(false);
  const [mySosSignals, setMySosSignals] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [sosActionId, setSosActionId] = useState(null);
  const myActivityLoadedRef = useRef(false);
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return window.Notification.permission;
  });

  // Reset tab caches when authenticated user changes.
  useEffect(() => {
    nearbyLoadedRef.current = false;
    nearbyCacheKeyRef.current = "";
    myActivityLoadedRef.current = false;
    setHostedActivities([]);
    setJoinedActivities([]);
    setHostedOffset(0);
    setHostedHasMore(false);
    setHostedLoadingMore(false);
    setJoinedOffset(0);
    setJoinedHasMore(false);
    setJoinedLoadingMore(false);
    setMySosSignals([]);
  }, [user?.id]);

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

  const fetchNearbyActivities = async ({ reset = false, locationOverride, queryVersion } = {}) => {
    const version = queryVersion ?? nearbyQueryVersionRef.current;
    const effectiveLocation = locationOverride !== undefined ? locationOverride : nearbyLocationRef.current;
    const offsetValue = reset ? 0 : nearbyOffset;

    if (reset) setNearbyLoading(true);
    else setNearbyLoadingMore(true);

    try {
      const params = effectiveLocation
        ? { lat: effectiveLocation.lat, lng: effectiveLocation.lng, radius: 50 }
        : {};

      if (debouncedSearchQuery) params.search = debouncedSearchQuery;
      if (dateFilter) params.date = dateFilter;
      if (visibilityFilter) params.visibility = visibilityFilter;
      params.offset = offsetValue;
      params.limit = FOR_YOU_PAGE_SIZE;

      const res = await activityAPI.getActivities(params);
      if (version !== nearbyQueryVersionRef.current) return;

      const fetched = res.data.activities || [];
      setNearbyActivities((prev) => {
        if (reset) return fetched;
        const merged = new Map(prev.map((item) => [item.id, item]));
        fetched.forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values());
      });

      if (reset) {
        nearbyLoadedRef.current = true;
      }

      const nextOffset = offsetValue + fetched.length;
      setNearbyOffset(nextOffset);
      setNearbyHasMore(Boolean(res.data.hasMore));
    } catch (err) {
      console.error("Failed to fetch activities", err);
      if (reset) {
        setNearbyActivities([]);
        setNearbyHasMore(false);
      }
    } finally {
      if (version === nearbyQueryVersionRef.current) {
        if (reset) setNearbyLoading(false);
        else setNearbyLoadingMore(false);
      }
    }
  };

  const refreshMySos = async () => {
    const sosRes = await sosAPI.getMine();
    setMySosSignals(sosRes.data.signals || []);
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("Browser notifications are not supported on this device.");
      return;
    }
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        alert("Notifications enabled. You will now receive SOS alerts.");
      } else {
        alert("Notifications are blocked. Please allow them in browser site settings.");
      }
    } catch (err) {
      console.error("Notification permission error:", err);
      alert("Unable to enable notifications right now.");
    }
  };

  const handleCompleteSos = async (id) => {
    if (sosActionId) return;
    setSosActionId(id);
    try {
      await sosAPI.completeById(id);
      await refreshMySos();
    } catch (err) {
      console.error("Failed to complete SOS:", err);
      alert("Failed to complete SOS. Please try again.");
    } finally {
      setSosActionId(null);
    }
  };

  const handleRemoveSos = async (id) => {
    if (sosActionId) return;
    if (!window.confirm("Remove this SOS entry?")) return;
    setSosActionId(id);
    try {
      await sosAPI.deleteById(id);
      setMySosSignals((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to remove SOS:", err);
      alert("Failed to remove SOS entry. Please try again.");
    } finally {
      setSosActionId(null);
    }
  };

  // Fetch nearby activities for "For You"
  useEffect(() => {
    if (activeTab !== "foryou") return;

    const currentCacheKey = `${debouncedSearchQuery}|${dateFilter}|${visibilityFilter}`;
    const isSameQuery = nearbyCacheKeyRef.current === currentCacheKey;

    // Keep tab data in memory when user switches tabs and comes back.
    if (isSameQuery && nearbyLoadedRef.current) {
      return;
    }

    nearbyCacheKeyRef.current = currentCacheKey;
    nearbyLoadedRef.current = false;

    let cancelled = false;
    const queryVersion = nearbyQueryVersionRef.current + 1;
    nearbyQueryVersionRef.current = queryVersion;
    nearbyLocationRef.current = null;
    setNearbyOffset(0);
    setNearbyHasMore(false);

    fetchNearbyActivities({ reset: true, locationOverride: null, queryVersion });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || queryVersion !== nearbyQueryVersionRef.current) return;
          const nextLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          nearbyLocationRef.current = nextLocation;
          fetchNearbyActivities({ reset: true, locationOverride: nextLocation, queryVersion });
        },
        () => {},
        { timeout: 5000 },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedSearchQuery, dateFilter, visibilityFilter]);

  const loadMoreNearbyActivities = () => {
    if (nearbyLoading || nearbyLoadingMore || !nearbyHasMore || activeTab !== "foryou") return;
    fetchNearbyActivities({ reset: false });
  };

  useEffect(() => {
    if (activeTab !== "foryou") return;
    const target = nearbyLoadMoreRef.current;
    if (!target || !nearbyHasMore || nearbyLoading || nearbyLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreNearbyActivities();
        }
      },
      { rootMargin: "220px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, nearbyHasMore, nearbyLoading, nearbyLoadingMore, nearbyOffset]);

  // Fetch user's activities for "Your Activity"
  useEffect(() => {
    if (activeTab !== "myactivity") return;
    if (myActivityLoadedRef.current) return;

    setMyLoading(true);
    Promise.all([activityAPI.getMyActivities({ limit: 10 }), sosAPI.getMine()])
      .then(([activitiesRes, sosRes]) => {
        const hosted = activitiesRes.data.hosted || [];
        const joined = activitiesRes.data.joined || [];

        setHostedActivities(hosted);
        setJoinedActivities(joined);
        setHostedHasMore(Boolean(activitiesRes.data.hostedHasMore));
        setHostedOffset(activitiesRes.data.hostedNextOffset ?? hosted.length);
        setJoinedHasMore(Boolean(activitiesRes.data.joinedHasMore));
        setJoinedOffset(activitiesRes.data.joinedNextOffset ?? joined.length);
        setMySosSignals(sosRes.data.signals || []);
        myActivityLoadedRef.current = true;
      })
      .catch((err) => console.error("Failed to fetch my activities", err))
      .finally(() => setMyLoading(false));
  }, [activeTab]);

  const loadMoreHosted = async () => {
    if (hostedLoadingMore || !hostedHasMore) return;

    setHostedLoadingMore(true);
    try {
      const res = await activityAPI.getMyActivities({
        hostedOffset,
        joinedOffset,
        limit: 10,
      });

      const fetchedHosted = res.data.hosted || [];
      setHostedActivities((prev) => {
        const merged = new Map(prev.map((item) => [item.id, item]));
        fetchedHosted.forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values());
      });

      setHostedHasMore(Boolean(res.data.hostedHasMore));
      setHostedOffset(res.data.hostedNextOffset ?? hostedOffset + fetchedHosted.length);
    } catch (err) {
      console.error("Failed to load more hosted activities", err);
    } finally {
      setHostedLoadingMore(false);
    }
  };

  const loadMoreJoined = async () => {
    if (joinedLoadingMore || !joinedHasMore) return;

    setJoinedLoadingMore(true);
    try {
      const res = await activityAPI.getMyActivities({
        hostedOffset,
        joinedOffset,
        limit: 10,
      });

      const fetchedJoined = res.data.joined || [];
      setJoinedActivities((prev) => {
        const merged = new Map(prev.map((item) => [item.id, item]));
        fetchedJoined.forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values());
      });

      setJoinedHasMore(Boolean(res.data.joinedHasMore));
      setJoinedOffset(res.data.joinedNextOffset ?? joinedOffset + fetchedJoined.length);
    } catch (err) {
      console.error("Failed to load more joined activities", err);
    } finally {
      setJoinedLoadingMore(false);
    }
  };

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

        {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
          <div
            className="card"
            style={{
              marginTop: "var(--space-4)",
              padding: "var(--space-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              border: "1px solid rgba(229, 62, 62, 0.25)",
              background: "rgba(229, 62, 62, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Bell size={16} color="#e53e3e" />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                Enable notifications to receive SOS alerts
              </span>
            </div>
            <button className="btn btn--danger btn--sm" onClick={requestNotificationPermission}>
              Allow
            </button>
          </div>
        )}
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
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", opacity: nearbyLoading ? 0.6 : 1, transition: "opacity 0.2s" }}>
                {nearbyActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>

              {nearbyHasMore && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-5)" }}>
                  <div ref={nearbyLoadMoreRef} style={{ width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
                  <button
                    className="btn btn--secondary"
                    onClick={loadMoreNearbyActivities}
                    disabled={nearbyLoadingMore}
                  >
                    {nearbyLoadingMore ? "Loading more..." : "Load More Activities"}
                  </button>
                </div>
              )}
            </>
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

                  {hostedHasMore && (
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={loadMoreHosted}
                        disabled={hostedLoadingMore}
                      >
                        {hostedLoadingMore ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state" style={{ marginBottom: "var(--space-8)", padding: "var(--space-6)" }}>
                  <p className="empty-state-text">You haven't created any activities yet.</p>
                  <Link to="/activities/create" className="btn btn--primary btn--sm" style={{ marginTop: "var(--space-3)" }}>
                    <Sparkles size={14} /> Create One
                  </Link>
                </div>
              )}

              {/* SOS */}
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <AlertTriangle size={18} color="#e53e3e" /> SOS Activity
              </h2>
              {mySosSignals.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
                  {mySosSignals.map((s) => {
                    const isBusy = sosActionId === s.id;
                    return (
                      <div
                        key={s.id}
                        className="card"
                        style={{
                          margin: 0,
                          border: s.isActive ? "1px solid rgba(229, 62, 62, 0.35)" : "1px solid var(--color-border)",
                          background: s.isActive ? "rgba(229, 62, 62, 0.06)" : "var(--color-surface)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                              <strong style={{ fontSize: "var(--text-base)" }}>SOS Signal</strong>
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  fontWeight: 700,
                                  color: s.isActive ? "#9b1c1c" : "#2f855a",
                                  background: s.isActive ? "rgba(229, 62, 62, 0.15)" : "rgba(47, 133, 90, 0.15)",
                                }}
                              >
                                {s.isActive ? "ACTIVE" : "COMPLETED"}
                              </span>
                            </div>
                            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                              {new Date(s.createdAt).toLocaleString()}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button className="btn btn--secondary btn--sm" onClick={() => navigate("/map")}>View on Map</button>
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => window.open(`https://www.google.com/maps?q=${s.latitude},${s.longitude}`, "_blank", "noopener,noreferrer")}
                            >
                              Open in Maps
                            </button>
                            {s.isActive ? (
                              <button
                                className="btn btn--danger btn--sm"
                                onClick={() => handleCompleteSos(s.id)}
                                disabled={!!sosActionId}
                              >
                                {isBusy ? "Completing..." : "Complete"}
                              </button>
                            ) : (
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => handleRemoveSos(s.id)}
                                disabled={!!sosActionId}
                              >
                                {isBusy ? "Removing..." : "Remove"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ marginBottom: "var(--space-8)", padding: "var(--space-6)" }}>
                  <p className="empty-state-text">No SOS signals yet.</p>
                  <p className="empty-state-text" style={{ marginTop: "var(--space-2)" }}>
                    Use the SOS button in the floating menu if you need urgent nearby help.
                  </p>
                </div>
              )}

              {/* Joined */}
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Users size={18} /> Joined
              </h2>
              {joinedActivities.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {joinedActivities.map((a) => <ActivityCard key={a.id} activity={a} />)}

                  {joinedHasMore && (
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={loadMoreJoined}
                        disabled={joinedLoadingMore}
                      >
                        {joinedLoadingMore ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
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
