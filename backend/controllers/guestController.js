const Guest = require("../models/guestModel");
const { sendSuccess, sendError } = require("../utils/response");

const VALID_ID_TYPES = ["Passport", "Driving License", "Aadhar Card", "National ID", "Other"];

const getAllGuests = async (req, res, next) => {
  try {
    const { search, idType, nationality } = req.query;
    const guests = await Guest.getAll({ search, idType, nationality });
    return sendSuccess(res, guests, "Guests retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

const getGuestById = async (req, res, next) => {
  try {
    const guest = await Guest.getById(req.params.id);
    if (!guest) {
      return sendError(res, "Guest record not found.", 404);
    }
    return sendSuccess(res, guest, "Guest details retrieved.");
  } catch (err) {
    next(err);
  }
};

const getGuestHistory = async (req, res, next) => {
  try {
    const guest = await Guest.getById(req.params.id);
    if (!guest) {
      return sendError(res, "Guest record not found.", 404);
    }
    const history = await Guest.getHistory(req.params.id);
    return sendSuccess(res, history, "Guest booking and stay history retrieved.");
  } catch (err) {
    next(err);
  }
};

const createGuest = async (req, res, next) => {
  try {
    const firstName = req.body.firstName || req.body.first_name;
    const lastName = req.body.lastName || req.body.last_name;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : null;
    const phone = req.body.phone ? req.body.phone.trim() : "";
    const idType = req.body.idType || req.body.id_type || "Aadhar Card";
    const idNumber = req.body.idNumber || req.body.id_number;
    const address = req.body.address ? req.body.address.trim() : null;
    const nationality = req.body.nationality ? req.body.nationality.trim() : "Indian";

    if (!firstName || !lastName || !phone || !idNumber) {
      return sendError(res, "First name, last name, phone, and ID number are required fields.", 400);
    }

    if (idType && !VALID_ID_TYPES.includes(idType)) {
      return sendError(res, `Invalid ID type. Allowed: ${VALID_ID_TYPES.join(", ")}`, 400);
    }

    const guest = await Guest.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      phone,
      idType,
      idNumber: idNumber.trim(),
      address,
      nationality,
    });

    return sendSuccess(res, guest, "Guest profile registered successfully.", 201);
  } catch (err) {
    if (err.code === "23505") {
      return sendError(res, "A guest with this phone number or email is already registered.", 409);
    }
    next(err);
  }
};

const updateGuest = async (req, res, next) => {
  try {
    const existing = await Guest.getById(req.params.id);
    if (!existing) {
      return sendError(res, "Guest record not found.", 404);
    }

    const idType = req.body.idType || req.body.id_type;
    if (idType && !VALID_ID_TYPES.includes(idType)) {
      return sendError(res, `Invalid ID type. Allowed: ${VALID_ID_TYPES.join(", ")}`, 400);
    }

    const updated = await Guest.update(req.params.id, req.body);
    return sendSuccess(res, updated, "Guest profile updated successfully.");
  } catch (err) {
    if (err.code === "23505") {
      return sendError(res, "A guest with this phone number or email is already registered.", 409);
    }
    next(err);
  }
};

const deleteGuest = async (req, res, next) => {
  try {
    const guest = await Guest.getById(req.params.id);
    if (!guest) {
      return sendError(res, "Guest record not found.", 404);
    }

    // Safeguard: Check if guest has active stay or reservations
    const hasActive = await Guest.hasActiveStayOrReservation(req.params.id);
    if (hasActive) {
      return sendError(
        res,
        `Cannot delete guest (${guest.first_name} ${guest.last_name}): Guest has active room reservations or an in-house stay. Please complete check-out or cancel bookings first.`,
        400
      );
    }

    await Guest.delete(req.params.id);
    return sendSuccess(res, { id: req.params.id }, "Guest record deleted successfully.");
  } catch (err) {
    if (err.code === "23503") {
      return sendError(res, "Cannot delete guest: Active financial or reservation records reference this profile.", 400);
    }
    next(err);
  }
};

module.exports = {
  getAllGuests,
  getGuestById,
  getGuestHistory,
  createGuest,
  updateGuest,
  deleteGuest,
};
