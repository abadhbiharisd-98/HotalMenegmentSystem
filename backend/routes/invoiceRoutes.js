const express = require("express");
const router = express.Router();
const {
  generateInvoice,
  getAllInvoices,
  getInvoiceStats,
  getEligibleReservations,
  getInvoiceById,
  getInvoiceByReservation,
  updateInvoiceStatus,
} = require("../controllers/invoiceController");
const { authenticateJWT } = require("../middleware/authMiddleware");

// All invoice routes require valid authentication
router.use(authenticateJWT);

// Named query and action routes (defined before :id to prevent collision)
router.get("/stats", getInvoiceStats);
router.get("/eligible-reservations", getEligibleReservations);
router.get("/reservation/:reservationId", getInvoiceByReservation);
router.post("/generate", generateInvoice);

// General listing
router.get("/", getAllInvoices);

// Single invoice operations
router.get("/:id", getInvoiceById);
router.patch("/:id/status", updateInvoiceStatus);

module.exports = router;
