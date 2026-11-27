const { query } = require("../config/db");

const User = {
  async findByEmail(email) {
    const res = await query("SELECT * FROM users WHERE email = $1", [email]);
    return res.rows[0];
  },

  async findById(id) {
    const res = await query(
      "SELECT id, full_name, email, role, phone, status, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );
    return res.rows[0];
  },

  async create({ fullName, email, passwordHash, role = "staff", phone = null }) {
    const res = await query(
      `INSERT INTO users (full_name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, phone, status, created_at`,
      [fullName, email, passwordHash, role, phone]
    );
    return res.rows[0];
  },

  async getAll() {
    const res = await query(
      "SELECT id, full_name, email, role, phone, status, created_at FROM users ORDER BY created_at DESC"
    );
    return res.rows;
  },
};

module.exports = User;
