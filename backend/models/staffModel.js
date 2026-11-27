const { query } = require("../config/db");

const Staff = {
  async getAll() {
    const sql = `
      SELECT s.*, u.full_name, u.email, u.phone, u.role
      FROM staff s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `;
    const res = await query(sql);
    return res.rows;
  },

  async create({ userId, department, position, salary = 0, hireDate, shift = "morning", status = "active" }) {
    const res = await query(
      `INSERT INTO staff (user_id, department, position, salary, hire_date, shift, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7)
       RETURNING *`,
      [userId, department, position, salary, hireDate, shift, status]
    );
    return res.rows[0];
  },

  async update(id, fields) {
    const res = await query(
      `UPDATE staff
       SET department = COALESCE($1, department),
           position = COALESCE($2, position),
           salary = COALESCE($3, salary),
           shift = COALESCE($4, shift),
           status = COALESCE($5, status)
       WHERE id = $6
       RETURNING *`,
      [fields.department, fields.position, fields.salary, fields.shift, fields.status, id]
    );
    return res.rows[0];
  },
};

module.exports = Staff;
