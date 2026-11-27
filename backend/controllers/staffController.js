const Staff = require("../models/staffModel");
const { sendSuccess, sendError } = require("../utils/response");

const getStaff = async (req, res, next) => {
  try {
    const staff = await Staff.getAll();
    return sendSuccess(res, staff, "Staff members retrieved.");
  } catch (err) {
    next(err);
  }
};

const createStaff = async (req, res, next) => {
  try {
    const { userId, department, position, salary, hireDate, shift, status } = req.body;
    if (!department || !position) {
      return sendError(res, "department and position are required.", 400);
    }

    const newStaff = await Staff.create({ userId, department, position, salary, hireDate, shift, status });
    return sendSuccess(res, newStaff, "Staff member created.", 201);
  } catch (err) {
    next(err);
  }
};

const updateStaff = async (req, res, next) => {
  try {
    const updated = await Staff.update(req.params.id, req.body);
    if (!updated) {
      return sendError(res, "Staff member not found.", 404);
    }
    return sendSuccess(res, updated, "Staff details updated.");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStaff,
  createStaff,
  updateStaff,
};
