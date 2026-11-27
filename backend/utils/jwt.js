const jwt = require("jsonwebtoken");

const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || "24h") => {
  return jwt.sign(payload, process.env.JWT_SECRET || "fallback_secret_key", { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key");
};

module.exports = {
  generateToken,
  verifyToken,
};
