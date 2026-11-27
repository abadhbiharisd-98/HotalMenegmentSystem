const express = require("express");
const router = express.Router();
const {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomTypes,
} = require("../controllers/roomController");
const { authenticateJWT, authorizeRoles } = require("../middleware/authMiddleware");

// Public or general room queries
router.get("/", getRooms);
router.get("/types", getRoomTypes);
router.get("/:id", getRoomById);

// Admin / Manager protected routes
router.post("/", authenticateJWT, authorizeRoles("admin", "manager"), createRoom);
router.put("/:id", authenticateJWT, authorizeRoles("admin", "manager"), updateRoom);
router.delete("/:id", authenticateJWT, authorizeRoles("admin"), deleteRoom);

module.exports = router;
