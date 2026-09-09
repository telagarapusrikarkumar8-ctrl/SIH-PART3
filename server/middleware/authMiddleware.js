const jwt = require("jsonwebtoken");

/**
 * Authentication Middleware
 * Extracts and verifies JWT from Authorization header: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Authentication token is missing."
    });
  }

  const jwtSecret = process.env.JWT_SECRET || "epaddy_sih_secure_jwt_secret_2026_kms";

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again."
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token."
    });
  }
}

module.exports = {
  authenticateToken
};
