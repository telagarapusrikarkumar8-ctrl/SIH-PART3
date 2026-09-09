/**
 * Role-Based Access Control (RBAC) Middleware
 */

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. No user role assigned."
      });
    }

    if (req.user.role.toLowerCase() !== requiredRole.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Requires '${requiredRole}' role privilege.`
      });
    }

    next();
  };
}

function requireOfficialRole(...allowedOfficialRoles) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== "official") {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Departmental official authorization required."
      });
    }

    if (allowedOfficialRoles.length > 0) {
      const userOfficialRole = req.user.officialRole || "";
      const isAllowed = allowedOfficialRoles.some(
        (role) => role.toLowerCase() === userOfficialRole.toLowerCase()
      );

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: `Access forbidden for designation '${userOfficialRole}'. Required: ${allowedOfficialRoles.join(", ")}`
        });
      }
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireOfficialRole
};
