const CheckInOut = require("../models/checkInOutModel");
const { sendSuccess, sendError } = require("../utils/response");

/**
 * Check-in a guest into the hotel
 * Enforces transaction safety, double check-in prevention, and room occupancy update
 */
const performCheckIn = async (req, res, next) => {
  try {
    const { reservationId, roomKeyStatus, notes, checkInTime } = req.body;
    if (!reservationId) {
      return sendError(res, "reservationId is required for check-in.", 400);
    }

    const checkInRecord = await CheckInOut.checkInTransaction({
      reservationId: parseInt(reservationId, 10),
      roomKeyStatus: roomKeyStatus || "issued",
      notes,
      handledBy: req.user ? req.user.id : null,
      checkInTime,
    });

    return sendSuccess(res, checkInRecord, "Guest checked in successfully. Room marked as Occupied.", 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Check-out a guest from the hotel
 * Enforces prior check-in verification, completion of booking, and safe room release
 */
const performCheckOut = async (req, res, next) => {
  try {
    const {
      reservationId,
      checkInOutId,
      roomKeyStatus,
      notes,
      checkOutTime,
      settlePayment,
      paymentMethod,
      transactionId,
    } = req.body;

    if (!reservationId && !checkInOutId) {
      return sendError(res, "Either reservationId or checkInOutId is required for check-out.", 400);
    }

    const checkOutRecord = await CheckInOut.checkOutTransaction({
      reservationId: reservationId ? parseInt(reservationId, 10) : null,
      checkInOutId: checkInOutId ? parseInt(checkInOutId, 10) : null,
      roomKeyStatus: roomKeyStatus || "returned",
      notes,
      handledBy: req.user ? req.user.id : null,
      checkOutTime,
      settlePayment,
      paymentMethod,
      transactionId,
    });

    return sendSuccess(res, checkOutRecord, "Guest checked out successfully. Room released to Available.", 200);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Retrieve currently checked-in guests (active stays)
 */
const getActiveStays = async (req, res, next) => {
  try {
    const { search, roomId } = req.query;
    const stays = await CheckInOut.getActiveStays({ search, roomId });
    return sendSuccess(res, stays, "Active in-house stays retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve reservations eligible for check-in
 */
const getEligibleReservations = async (req, res, next) => {
  try {
    const { search } = req.query;
    const reservations = await CheckInOut.getEligibleReservations({ search });
    return sendSuccess(res, reservations, "Eligible reservations retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve stay history (active and completed)
 */
const getHistory = async (req, res, next) => {
  try {
    const { search, status, startDate, endDate, limit } = req.query;
    const history = await CheckInOut.getHistory({ search, status, startDate, endDate, limit });
    return sendSuccess(res, history, "Check-in/out history retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve live summary metrics
 */
const getSummaryMetrics = async (req, res, next) => {
  try {
    const metrics = await CheckInOut.getSummaryMetrics();
    return sendSuccess(res, metrics, "Summary metrics retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve check-in status for a single reservation
 */
const getCheckInStatus = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const status = await CheckInOut.getByReservationId(reservationId);
    if (!status) {
      return sendError(res, "Check-in record not found for this reservation.", 404);
    }
    return sendSuccess(res, status, "Check-in record retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  performCheckIn,
  performCheckOut,
  getActiveStays,
  getEligibleReservations,
  getHistory,
  getSummaryMetrics,
  getCheckInStatus,
};
