const Expense = require("../models/expenseModel");
const { sendSuccess, sendError } = require("../utils/response");

/**
 * Get all expenses with search, filters, and sorting.
 */
const getExpenses = async (req, res, next) => {
  try {
    const { search, category, paymentMethod, fromDate, toDate, sort } = req.query;
    const expenses = await Expense.getAll({
      search,
      category,
      paymentMethod,
      fromDate,
      toDate,
      sort,
    });
    return sendSuccess(res, expenses, "Expenses retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Get aggregated expense statistics for the dashboard.
 */
const getExpenseStats = async (req, res, next) => {
  try {
    const stats = await Expense.getStats();
    return sendSuccess(res, stats, "Expense statistics retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Generate daily, monthly, yearly, or category-wise expense reports.
 */
const getExpenseReports = async (req, res, next) => {
  try {
    const { period, startDate, endDate, category } = req.query;
    const reports = await Expense.getReports({
      period,
      startDate,
      endDate,
      category,
    });
    return sendSuccess(res, reports, "Expense report generated successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Get single expense by ID.
 */
const getExpenseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expense = await Expense.getById(id);
    if (!expense) {
      return sendError(res, `Expense with ID ${id} not found.`, 404);
    }
    return sendSuccess(res, expense, "Expense details retrieved.");
  } catch (err) {
    next(err);
  }
};

/**
 * Record a new expense.
 */
const createExpense = async (req, res, next) => {
  try {
    const { title, category, amount, paymentMethod, expenseDate, description } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, "Expense title is required.", 400);
    }
    if (!category) {
      return sendError(res, "Expense category is required.", 400);
    }
    if (amount === undefined || amount === null || amount === "") {
      return sendError(res, "Expense amount is required.", 400);
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return sendError(res, "Amount must be a positive number greater than zero.", 400);
    }

    const expense = await Expense.create({
      title,
      category,
      amount: numAmount,
      paymentMethod: paymentMethod || "cash",
      expenseDate,
      description,
      recordedBy: req.user ? req.user.id : null,
    });

    return sendSuccess(res, expense, "Expense recorded successfully.", 201);
  } catch (err) {
    if (
      err.message.includes("Invalid category") ||
      err.message.includes("Invalid payment method") ||
      err.message.includes("Amount must be")
    ) {
      return sendError(res, err.message, 400);
    }
    next(err);
  }
};

/**
 * Edit an existing expense.
 */
const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, category, amount, paymentMethod, expenseDate, description } = req.body;

    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return sendError(res, "Amount must be a positive number greater than zero.", 400);
      }
    }

    const updated = await Expense.update(id, {
      title,
      category,
      amount,
      paymentMethod,
      expenseDate,
      description,
    });

    return sendSuccess(res, updated, "Expense updated successfully.");
  } catch (err) {
    if (err.message.includes("not found")) {
      return sendError(res, err.message, 404);
    }
    if (
      err.message.includes("Invalid category") ||
      err.message.includes("Invalid payment method") ||
      err.message.includes("Amount must be")
    ) {
      return sendError(res, err.message, 400);
    }
    next(err);
  }
};

/**
 * Safely delete an expense.
 */
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Expense.delete(id);
    return sendSuccess(res, deleted, "Expense deleted successfully.");
  } catch (err) {
    if (err.message.includes("not found")) {
      return sendError(res, err.message, 404);
    }
    next(err);
  }
};

/**
 * Preserved category summary.
 */
const getExpenseSummary = async (req, res, next) => {
  try {
    const summary = await Expense.getSummaryByCategory();
    return sendSuccess(res, summary, "Expense summary retrieved.");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getExpenses,
  getExpenseStats,
  getExpenseReports,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
};
