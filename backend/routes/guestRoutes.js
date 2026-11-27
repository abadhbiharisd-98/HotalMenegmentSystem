const express = require("express");
const router = express.Router();
const {
  getAllGuests,
  getGuestById,
  getGuestHistory,
  createGuest,
  updateGuest,
  deleteGuest,
} = require("../controllers/guestController");
const { authenticateJWT, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateJWT, getAllGuests);
router.get("/:id", authenticateJWT, getGuestById);
router.get("/:id/history", authenticateJWT, getGuestHistory);
router.post("/", authenticateJWT, createGuest);
router.put("/:id", authenticateJWT, updateGuest);
router.delete("/:id", authenticateJWT, authorizeRoles("admin", "manager"), deleteGuest);

module.exports = router;
