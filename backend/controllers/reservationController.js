const Reservation = require("../models/reservationModel");
const Room = require("../models/roomModel");
const Payment = require("../models/paymentModel");
const { sendSuccess, sendError } = require("../utils/response");

const VALID_STATUSES = ["pending", "confirmed", "cancelled", "completed"];

const getAllReservations = async (req, res, next) => {
  try {
    const { status, search, fromDate, toDate } = req.query;
    const reservations = await Reservation.getAll({ status, search, fromDate, toDate });
    return sendSuccess(res, reservations, "Reservations retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

const getReservationById = async (req, res, next) => {
  try {
    const reservation = await Reservation.getById(req.params.id);
    if (!reservation) {
      return sendError(res, "Reservation record not found.", 404);
    }
    return sendSuccess(res, reservation, "Reservation details retrieved.");
  } catch (err) {
    next(err);
  }
};

const getAvailableRooms = async (req, res, next) => {
  try {
    const { checkInDate, checkOutDate, roomTypeId } = req.query;
    if (!checkInDate || !checkOutDate) {
      return sendError(res, "checkInDate and checkOutDate are required to search room availability.", 400);
    }

    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      return sendError(res, "Check-out date must be strictly after check-in date.", 400);
    }

    const available = await Reservation.getAvailableRooms(checkInDate, checkOutDate, roomTypeId);
    return sendSuccess(res, available, "Available rooms retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

const createReservation = async (req, res, next) => {
  try {
    const guestId = req.body.guestId || req.body.guest_id;
    const roomId = req.body.roomId || req.body.room_id;
    const checkInDate = req.body.checkInDate || req.body.check_in_date;
    const checkOutDate = req.body.checkOutDate || req.body.check_out_date;
    const numberOfGuests = req.body.numberOfGuests || req.body.number_of_guests || 1;
    const specialRequests = req.body.specialRequests || req.body.special_requests || null;
    const advanceAmount = req.body.advanceAmount || req.body.advance_amount || 0;
    const paymentMethod = req.body.paymentMethod || req.body.payment_method || "cash";

    if (!guestId || !roomId || !checkInDate || !checkOutDate) {
      return sendError(res, "guestId, roomId, checkInDate, and checkOutDate are required.", 400);
    }

    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);

    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      return sendError(res, "Invalid date format. Expected YYYY-MM-DD.", 400);
    }

    if (outDate <= inDate) {
      return sendError(res, "Check-out date must be strictly after check-in date.", 400);
    }

    const diffDays = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    const nights = diffDays > 0 ? diffDays : 1;

    // Check if room exists and is not under maintenance
    const room = await Room.getById(roomId);
    if (!room) {
      return sendError(res, "Selected room does not exist.", 404);
    }

    if (room.status === "maintenance") {
      return sendError(res, `Room #${room.room_number} is currently under maintenance and cannot be reserved.`, 400);
    }

    // Backend Date Conflict Safeguard (Prevent overlapping bookings)
    const conflict = await Reservation.checkConflict(roomId, checkInDate, checkOutDate);
    if (conflict) {
      return sendError(
        res,
        `Room #${conflict.room_number} already has a ${conflict.status} reservation from ${conflict.check_in_date} to ${conflict.check_out_date}. Please choose another room or date range.`,
        409
      );
    }

    // Calculate room charges
    const calculatedTotal = nights * parseFloat(room.price_per_night);
    const totalAmount = req.body.totalAmount ? parseFloat(req.body.totalAmount) : calculatedTotal;

    // Determine initial status based on advance payment
    const initialStatus = parseFloat(advanceAmount) > 0 ? "confirmed" : "pending";

    const created = await Reservation.create({
      guestId,
      roomId,
      checkInDate,
      checkOutDate,
      numberOfGuests: parseInt(numberOfGuests, 10),
      totalAmount,
      specialRequests,
      createdBy: req.user ? req.user.id : null,
    });

    // If advance payment was provided, record it in payments table
    if (parseFloat(advanceAmount) > 0) {
      let normalizedMethod = (paymentMethod || 'cash').toLowerCase().trim();
      if (normalizedMethod === 'card' || normalizedMethod === 'credit card') normalizedMethod = 'credit_card';
      if (normalizedMethod === 'debit card') normalizedMethod = 'debit_card';
      if (normalizedMethod === 'bank transfer') normalizedMethod = 'bank_transfer';
      const validMethods = ['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer'];
      if (!validMethods.includes(normalizedMethod)) {
        normalizedMethod = 'cash';
      }

      await Payment.create({
        reservationId: created.id,
        amount: parseFloat(advanceAmount),
        paymentMethod: normalizedMethod,
        paymentStatus: "completed",
        transactionId: req.body.transactionId || `ADV-${Date.now()}`,
        recordedBy: req.user ? req.user.id : null,
      });

      // Update to confirmed
      await Reservation.updateStatus(created.id, "confirmed");
    }

    // NOTE (Rule #7): We DO NOT mark room as 'occupied' here.
    // Occupancy only changes when front-desk actual check-in takes place.

    const fullReservation = await Reservation.getById(created.id);
    return sendSuccess(res, fullReservation, "Reservation created successfully.", 201);
  } catch (err) {
    next(err);
  }
};

const updateReservation = async (req, res, next) => {
  try {
    const existing = await Reservation.getById(req.params.id);
    if (!existing) {
      return sendError(res, "Reservation record not found.", 404);
    }

    if (existing.status === "completed") {
      return sendError(res, "Completed reservations cannot be modified.", 400);
    }
    if (existing.status === "cancelled") {
      return sendError(res, "Cancelled reservations cannot be modified.", 400);
    }

    const roomId = req.body.roomId || req.body.room_id || existing.room_id;
    const checkInDate = req.body.checkInDate || req.body.check_in_date || existing.check_in_date;
    const checkOutDate = req.body.checkOutDate || req.body.check_out_date || existing.check_out_date;
    const numberOfGuests = req.body.numberOfGuests || req.body.number_of_guests || existing.number_of_guests;
    const specialRequests = req.body.specialRequests !== undefined ? req.body.specialRequests : existing.special_requests;

    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);

    if (outDate <= inDate) {
      return sendError(res, "Check-out date must be strictly after check-in date.", 400);
    }

    // Check room status & conflicts
    const room = await Room.getById(roomId);
    if (!room) {
      return sendError(res, "Selected room does not exist.", 404);
    }
    if (room.status === "maintenance") {
      return sendError(res, `Room #${room.room_number} is currently under maintenance.`, 400);
    }

    const conflict = await Reservation.checkConflict(roomId, checkInDate, checkOutDate, req.params.id);
    if (conflict) {
      return sendError(
        res,
        `Date conflict: Room #${conflict.room_number} is already booked from ${conflict.check_in_date} to ${conflict.check_out_date}.`,
        409
      );
    }

    const diffDays = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    const nights = diffDays > 0 ? diffDays : 1;
    const calculatedTotal = nights * parseFloat(room.price_per_night);
    const totalAmount = req.body.totalAmount ? parseFloat(req.body.totalAmount) : calculatedTotal;

    await Reservation.update(req.params.id, {
      roomId,
      checkInDate,
      checkOutDate,
      numberOfGuests: parseInt(numberOfGuests, 10),
      totalAmount,
      specialRequests,
    });

    const updated = await Reservation.getById(req.params.id);
    return sendSuccess(res, updated, "Reservation updated successfully.");
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return sendError(res, "status is required.", 400);
    }

    if (!VALID_STATUSES.includes(status)) {
      return sendError(res, `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`, 400);
    }

    const existing = await Reservation.getById(req.params.id);
    if (!existing) {
      return sendError(res, "Reservation record not found.", 404);
    }

    // Business Rules for status transitions
    if (existing.status === "completed" && status !== "completed") {
      return sendError(res, "Completed reservations cannot be changed or reopened.", 400);
    }
    if (existing.status === "cancelled" && status !== "cancelled") {
      return sendError(res, "Cancelled reservations cannot be reopened.", 400);
    }

    // Prevent cancellation if currently checked-in
    if (status === "cancelled" && existing.actual_check_in && !existing.actual_check_out) {
      return sendError(
        res,
        "Cannot cancel reservation while guest is actively checked-in. Please process guest check-out first.",
        400
      );
    }

    const updated = await Reservation.updateStatus(req.params.id, status);
    return sendSuccess(res, updated, `Reservation status changed to ${status}.`);
  } catch (err) {
    next(err);
  }
};

const deleteReservation = async (req, res, next) => {
  try {
    const existing = await Reservation.getById(req.params.id);
    if (!existing) {
      return sendError(res, "Reservation record not found.", 404);
    }

    // Safeguard: Cannot delete reservation with active check-in
    if (existing.actual_check_in && !existing.actual_check_out) {
      return sendError(
        res,
        "Cannot delete reservation: Guest is currently checked-in to Room #" + existing.room_number + ".",
        400
      );
    }

    await Reservation.delete(req.params.id);
    return sendSuccess(res, { id: req.params.id }, "Reservation deleted successfully.");
  } catch (err) {
    if (err.code === "23503") {
      return sendError(res, "Cannot delete reservation because existing billing or check-in records reference it.", 400);
    }
    next(err);
  }
};

module.exports = {
  getAllReservations,
  getReservationById,
  getAvailableRooms,
  createReservation,
  updateReservation,
  updateStatus,
  deleteReservation,
};
