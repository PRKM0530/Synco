/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.message);
  console.error(err.stack);

  // Prisma known errors
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "field";
    return res.status(409).json({
      error: `A record with this ${field} already exists.`,
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found." });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token." });
  }

  // Default
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Internal server error.",
  });
};

module.exports = errorHandler;
