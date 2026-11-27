const User = require("../models/userModel");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { sendSuccess, sendError } = require("../utils/response");

const register = async (req, res, next) => {
  try {
    const { fullName, email, password, role, phone } = req.body;

    if (!fullName || !email || !password) {
      return sendError(res, "Full name, email, and password are required.", 400);
    }

    const existing = await User.findByEmail(email.toLowerCase().trim());
    if (existing) {
      return sendError(res, "A user with this email already exists.", 409);
    }

    const passwordHash = await hashPassword(password);
    const newUser = await User.create({
      fullName,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || "staff",
      phone,
    });

    const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });

    return sendSuccess(res, { user: newUser, token }, "User registered successfully.", 201);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, "Email and password are required.", 400);
    }

    const user = await User.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return sendError(res, "Invalid email or password.", 401);
    }

    if (user.status !== "active") {
      return sendError(res, "Account is suspended or inactive. Please contact admin.", 403);
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return sendError(res, "Invalid email or password.", 401);
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    const userProfile = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };

    return sendSuccess(res, { user: userProfile, token }, "Login successful.");
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, "User not found.", 404);
    }
    return sendSuccess(res, user, "User profile retrieved.");
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.getAll();
    return sendSuccess(res, users, "All users retrieved.");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  getAllUsers,
};
