const express = require("express");
const router = express.Router();
const { register, login, getProfile, getAllUsers } = require("../controllers/authController");
const { authenticateJWT, authorizeRoles } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/me", authenticateJWT, getProfile);
router.get("/users", authenticateJWT, authorizeRoles("admin", "manager"), getAllUsers);

module.exports = router;
