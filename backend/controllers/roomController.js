const Room = require("../models/roomModel");
const { sendSuccess, sendError } = require("../utils/response");

const getRooms = async (req, res, next) => {
  try {
    const { status, roomTypeId, floor } = req.query;
    const rooms = await Room.getAll({ status, roomTypeId, floor });
    return sendSuccess(res, rooms, "Rooms retrieved successfully.");
  } catch (err) {
    next(err);
  }
};

const getRoomById = async (req, res, next) => {
  try {
    const room = await Room.getById(req.params.id);
    if (!room) {
      return sendError(res, "Room not found.", 404);
    }
    return sendSuccess(res, room, "Room details retrieved.");
  } catch (err) {
    next(err);
  }
};

const createRoom = async (req, res, next) => {
  try {
    const roomNumber = req.body.roomNumber || req.body.room_number;
    const roomTypeId = req.body.roomTypeId || req.body.room_type_id;
    const floor = req.body.floor !== undefined ? parseInt(req.body.floor, 10) : 1;
    const status = req.body.status || "available";
    const pricePerNight = req.body.pricePerNight !== undefined ? req.body.pricePerNight : req.body.price_per_night;

    if (!roomNumber || !roomTypeId || pricePerNight === undefined || pricePerNight === null) {
      return sendError(res, "Room number, room type, and price per night are required.", 400);
    }

    if (parseFloat(pricePerNight) < 0) {
      return sendError(res, "Price per night cannot be negative.", 400);
    }

    const created = await Room.create({
      roomNumber,
      roomTypeId,
      floor,
      status,
      pricePerNight: parseFloat(pricePerNight),
    });

    // Fetch complete room with joined room_type details
    const room = await Room.getById(created.id);
    return sendSuccess(res, room, "Room created successfully.", 201);
  } catch (err) {
    if (err.code === "23505") {
      const roomNum = req.body.roomNumber || req.body.room_number || "";
      return sendError(res, `Room number "${roomNum}" already exists.`, 409);
    }
    next(err);
  }
};

const updateRoom = async (req, res, next) => {
  try {
    const existing = await Room.getById(req.params.id);
    if (!existing) {
      return sendError(res, "Room not found.", 404);
    }

    const roomNumber = req.body.roomNumber ?? req.body.room_number;
    const roomTypeId = req.body.roomTypeId ?? req.body.room_type_id;
    const floor = req.body.floor !== undefined ? parseInt(req.body.floor, 10) : undefined;
    const status = req.body.status;
    const pricePerNight =
      req.body.pricePerNight !== undefined
        ? parseFloat(req.body.pricePerNight)
        : req.body.price_per_night !== undefined
        ? parseFloat(req.body.price_per_night)
        : undefined;

    if (pricePerNight !== undefined && pricePerNight < 0) {
      return sendError(res, "Price per night cannot be negative.", 400);
    }

    await Room.update(req.params.id, {
      roomNumber,
      roomTypeId,
      floor,
      status,
      pricePerNight,
    });

    const updated = await Room.getById(req.params.id);
    return sendSuccess(res, updated, "Room updated successfully.");
  } catch (err) {
    if (err.code === "23505") {
      const roomNum = req.body.roomNumber || req.body.room_number || "";
      return sendError(res, `Room number "${roomNum}" already exists.`, 409);
    }
    next(err);
  }
};

const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.getById(req.params.id);
    if (!room) {
      return sendError(res, "Room not found.", 404);
    }

    // Safeguard: Never delete an occupied room
    if (room.status === "occupied") {
      return sendError(
        res,
        `Cannot delete Room #${room.room_number}: Room is currently marked as Occupied. Please check out the guest first.`,
        400
      );
    }

    // Safeguard: Check active bookings or reservations
    const hasActive = await Room.hasActiveBookings(req.params.id);
    if (hasActive) {
      return sendError(
        res,
        `Cannot delete Room #${room.room_number}: Room has active reservations or in-house guest records.`,
        400
      );
    }

    await Room.delete(req.params.id);
    return sendSuccess(res, { id: req.params.id }, "Room deleted successfully.");
  } catch (err) {
    if (err.code === "23503") {
      return sendError(
        res,
        "Cannot delete this room because foreign key records reference it.",
        400
      );
    }
    next(err);
  }
};

const getRoomTypes = async (req, res, next) => {
  try {
    const types = await Room.getRoomTypes();
    return sendSuccess(res, types, "Room types retrieved.");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomTypes,
};
