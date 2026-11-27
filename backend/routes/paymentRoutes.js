const express = require("express");
const router = express.Router();
const {
  createPayment,
  processRefund,
  getAllPayments,
  getPaymentStats,
  getPendingReservations,
  getPaymentById,
  getPaymentsByReservation,
} = require("../controllers/paymentController");
const { authenticateJWT } = require("../middleware/authMiddleware");

// All payment endpoints require authentication
router.use(authenticateJWT);

// Specific collection & query endpoints (defined first to prevent collision with :id)
router.get("/stats", getPaymentStats);
router.get("/pending-reservations", getPendingReservations);
router.get("/reservation/:reservationId", getPaymentsByReservation);

// General listing and creation
router.get("/", getAllPayments);
router.post("/", createPayment);

// Single payment operations
router.get("/:id", getPaymentById);
router.post("/:id/refund", processRefund);

module.exports = router;
