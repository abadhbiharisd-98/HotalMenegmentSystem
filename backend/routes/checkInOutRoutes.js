const express = require("express");
const router = express.Router();
const {
  performCheckIn,
  performCheckOut,
  getActiveStays,
  getEligibleReservations,
  getHistory,
  getSummaryMetrics,
  getCheckInStatus,
} = require("../controllers/checkInOutController");
const { authenticateJWT } = require("../middleware/authMiddleware");

// All check-in/out routes require valid authentication
router.use(authenticateJWT);

// Specific collection & query endpoints (defined first to prevent collision with :reservationId)
router.get("/active", getActiveStays);
router.get("/eligible", getEligibleReservations);
router.get("/history", getHistory);
router.get("/summary", getSummaryMetrics);

// Transactional action endpoints
router.post("/check-in", performCheckIn);
router.post("/check-out", performCheckOut);

// Single reservation check-in lookup
router.get("/:reservationId", getCheckInStatus);

module.exports = router;
