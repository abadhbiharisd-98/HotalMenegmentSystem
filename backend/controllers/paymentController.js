const Payment = require("../models/paymentModel");
const { sendSuccess, sendError } = require("../utils/response");

/**
 * Record a new payment with overpayment safeguards and transaction safety
 */
const createPayment = async (req, res, next) => {
  try {
    const { reservationId, amount, paymentMethod, transactionId, notes } = req.body;

    if (!reservationId) {
      return sendError(res, "reservationId is required.", 400);
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return sendError(res, "Valid payment amount greater than 0 is required.", 400);
    }
    if (!paymentMethod) {
      return sendError(res, "paymentMethod is required.", 400);
    }

    const payment = await Payment.recordPaymentTransaction({
      reservationId: parseInt(reservationId, 10),
      amount: parseFloat(amount),
      paymentMethod,
      transactionId,
      recordedBy: req.user ? req.user.id : null,
      notes,
    });

    return sendSuccess(res, payment, "Payment recorded successfully.", 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Process a controlled refund for a completed payment
 */
const processRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      return sendError(res, "Payment ID is required.", 400);
    }

    const refunded = await Payment.processRefundTransaction({
      paymentId: parseInt(id, 10),
      reason: reason || "Guest refund request",
      refundedBy: req.user ? req.user.id : null,
    });

    return sendSuccess(res, refunded, "Payment refund processed successfully.", 200);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Directory of all payments with search and filters
 */
const getAllPayments = async (req, res, next) => {
  try {
    const { search, method, status, startDate, endDate, sortBy, limit } = req.query;
    const payments = await Payment.getAll({ search, method, status, startDate, endDate, sortBy, limit });
    return sendSuccess(res, payments, "Payments retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Live KPI Statistics for Payment Dashboard
 */
const getPaymentStats = async (req, res, next) => {
  try {
    const stats = await Payment.getStats();
    return sendSuccess(res, stats, "Payment metrics retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Unpaid / Partially Paid reservations with outstanding balances
 */
const getPendingReservations = async (req, res, next) => {
  try {
    const { search } = req.query;
    const pending = await Payment.getPendingReservations({ search });
    return sendSuccess(res, pending, "Pending balance reservations retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Single payment folio details for printable receipt
 */
const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await Payment.getById(id);
    if (!payment) {
      return sendError(res, "Payment record not found.", 404);
    }
    return sendSuccess(res, payment, "Payment details retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Payments for a specific reservation
 */
const getPaymentsByReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const payments = await Payment.getByReservation(reservationId);
    return sendSuccess(res, payments, "Reservation payments retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPayment,
  processRefund,
  getAllPayments,
  getPaymentStats,
  getPendingReservations,
  getPaymentById,
  getPaymentsByReservation,
};
