const express = require("express");
const router = express.Router();
const {
  getAllReservations,
  getReservationById,
  getAvailableRooms,
  createReservation,
  updateReservation,
  updateStatus,
  deleteReservation,
} = require("../controllers/reservationController");
const { authenticateJWT, authorizeRoles } = require("../middleware/authMiddleware");

// Specific routes first
router.get("/available-rooms", authenticateJWT, getAvailableRooms);

// General reservation collection
router.get("/", authenticateJWT, getAllReservations);
router.post("/", authenticateJWT, createReservation);

// Specific reservation by ID
router.get("/:id", authenticateJWT, getReservationById);
router.put("/:id", authenticateJWT, updateReservation);
router.patch("/:id/status", authenticateJWT, updateStatus);
router.delete("/:id", authenticateJWT, authorizeRoles("admin", "manager"), deleteReservation);

module.exports = router;
