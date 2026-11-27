const Invoice = require("../models/invoiceModel");
const { sendSuccess, sendError } = require("../utils/response");

/**
 * Generate an invoice from reservation and stay records
 * Rule #5, #6, #7: Tax rate defaults to 0% if unconfigured; does not invent GST rates
 * Rule #9: Prevents duplicate invoices for the same reservation
 * Rule #10: Reconciles payments without inserting duplicate payment rows
 */
const generateInvoice = async (req, res, next) => {
  try {
    const { reservationId, taxPercent = 0, discountAmount = 0, dueDate } = req.body;

    if (!reservationId) {
      return sendError(res, "reservationId is required for invoice generation.", 400);
    }

    const invoice = await Invoice.generateInvoiceTransaction({
      reservationId: parseInt(reservationId, 10),
      taxPercent: parseFloat(taxPercent) || 0,
      discountAmount: parseFloat(discountAmount) || 0,
      dueDate,
    });

    return sendSuccess(res, invoice, `Invoice ${invoice.invoice_number} generated successfully.`, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Directory of all invoices with search and filters
 */
const getAllInvoices = async (req, res, next) => {
  try {
    const { search, paymentStatus, startDate, endDate, sortBy, limit } = req.query;
    const invoices = await Invoice.getAll({ search, paymentStatus, startDate, endDate, sortBy, limit });
    return sendSuccess(res, invoices, "Invoices retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Live KPI Statistics for Billing Dashboard
 */
const getInvoiceStats = async (req, res, next) => {
  try {
    const stats = await Invoice.getStats();
    return sendSuccess(res, stats, "Invoice metrics retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Reservations eligible for invoice generation (not yet invoiced)
 */
const getEligibleReservations = async (req, res, next) => {
  try {
    const { search } = req.query;
    const eligible = await Invoice.getEligibleReservations({ search });
    return sendSuccess(res, eligible, "Eligible reservations retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Complete invoice details with guest, room, and payment ledger for printing
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.getById(id);
    if (!invoice) {
      return sendError(res, "Invoice not found.", 404);
    }
    return sendSuccess(res, invoice, "Invoice details retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Invoice by reservation ID
 */
const getInvoiceByReservation = async (req, res, next) => {
  try {
    const invoice = await Invoice.getByReservation(req.params.reservationId);
    if (!invoice) {
      return sendError(res, "Invoice not found for this reservation.", 404);
    }
    return sendSuccess(res, invoice, "Invoice retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Update payment status of an existing invoice
 */
const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!paymentStatus) {
      return sendError(res, "paymentStatus is required.", 400);
    }

    const updated = await Invoice.updatePaymentStatus(id, paymentStatus);
    return sendSuccess(res, updated, `Invoice payment status updated to '${paymentStatus}'.`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generateInvoice,
  getAllInvoices,
  getInvoiceStats,
  getEligibleReservations,
  getInvoiceById,
  getInvoiceByReservation,
  updateInvoiceStatus,
};
