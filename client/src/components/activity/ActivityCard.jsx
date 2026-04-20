import { Link } from "react-router-dom";
import { Calendar, Clock, Users } from "lucide-react";
import CategoryIcon from "../common/CategoryIcon";

const ActivityCard = ({ activity }) => {
  const {
    id,
    title,
    category,
    tags,
    date,
    location,
    host,
    members,
    _count,
    distance,
    maxParticipants,
  } = activity;

  const eventDate = new Date(date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const getInitials = (name) => name?.charAt(0).toUpperCase() || "?";

  const memberCount = _count ? _count.members : members ? members.length : 1;

  return (
    <Link
      to={`/activities/${id}`}
      className="card card--hover"
      style={{
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-4)",
        gap: "var(--space-3)",
      }}
    >
      {/* Header: Category + Distance + Host */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-surface-hover)",
              padding: "var(--space-2)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-primary-light)",
            }}
          >
            <CategoryIcon category={category} size={20} />
          </span>
          <div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--color-primary-light)",
                fontSize: "var(--text-sm)",
              }}
            >
              {category}
            </div>
            {distance !== undefined && (
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                {distance < 1
                  ? "< 1 km away"
                  : `${distance.toFixed(1)} km away`}
              </div>
            )}
          </div>
        </div>

        <Link
          to={`/profile/${host?.id}`}
          className="avatar avatar--sm"
          title={`Host: ${host?.displayName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {host?.profilePhoto ? (
            <img src={host.profilePhoto} alt={host.displayName} />
          ) : (
            getInitials(host?.displayName)
          )}
        </Link>
      </div>

      {/* Main content */}
      <div>
        <h3
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            marginBottom: "var(--space-1)",
            color: "var(--color-text)",
          }}
        >
          {title}
        </h3>
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Calendar size={14} /> {formattedDate}</span>
          <span>•</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={14} /> {formattedTime}</span>
        </div>
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div
          style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
        >
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
          {tags.length > 3 && <span className="tag">+{tags.length - 3}</span>}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
          paddingTop: "var(--space-2)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <Users size={16} /> {memberCount} / {maxParticipants} joined
        </span>
        <button className="btn btn--sm btn--primary">View Details</button>
      </div>
    </Link>
  );
};

export default ActivityCard;
