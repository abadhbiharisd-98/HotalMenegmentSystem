const express = require("express");
const router = express.Router();
const {
  getStaff,
  createStaff,
  updateStaff,
} = require("../controllers/staffController");
const { authenticateJWT, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateJWT, authorizeRoles("admin", "manager"), getStaff);
router.post("/", authenticateJWT, authorizeRoles("admin"), createStaff);
router.put("/:id", authenticateJWT, authorizeRoles("admin"), updateStaff);

module.exports = router;
