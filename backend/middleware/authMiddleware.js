const { verifyToken } = require("../utils/jwt");
const { sendError } = require("../utils/response");

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Access denied. No token provided.", 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return sendError(res, "Invalid or expired token.", 401);
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, "Forbidden: You do not have permission to access this resource.", 403);
    }
    next();
  };
};

module.exports = {
  authenticateJWT,
  authorizeRoles,
};
