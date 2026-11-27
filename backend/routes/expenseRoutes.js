const express = require("express");
const router = express.Router();
const {
  getExpenses,
  getExpenseStats,
  getExpenseReports,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} = require("../controllers/expenseController");
const { authenticateJWT } = require("../middleware/authMiddleware");

// All expense endpoints require JWT authentication (Rule #10)
router.use(authenticateJWT);

// Specific collection & reporting endpoints (defined first to prevent collision with :id)
router.get("/stats", getExpenseStats);
router.get("/reports", getExpenseReports);
router.get("/summary", getExpenseSummary);

// General listing and creation
router.get("/", getExpenses);
router.post("/", createExpense);

// Single expense operations
router.get("/:id", getExpenseById);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
