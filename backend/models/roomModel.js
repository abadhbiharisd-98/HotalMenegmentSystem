const { query } = require("../config/db");

const Room = {
  async getAll({ status, roomTypeId, floor } = {}) {
    let sql = `
      SELECT r.id, r.room_number, r.room_type_id, r.floor, r.status, r.price_per_night, r.created_at,
             rt.name AS room_type, rt.capacity, rt.amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (roomTypeId) {
      params.push(roomTypeId);
      sql += ` AND r.room_type_id = $${params.length}`;
    }
    if (floor) {
      params.push(floor);
      sql += ` AND r.floor = $${params.length}`;
    }

    sql += " ORDER BY r.room_number ASC";
    const res = await query(sql, params);
    return res.rows;
  },

  async getById(id) {
    const sql = `
      SELECT r.id, r.room_number, r.room_type_id, r.floor, r.status, r.price_per_night, r.created_at,
             rt.name AS room_type, rt.description, rt.capacity, rt.amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0];
  },

  async create({ roomNumber, roomTypeId, floor = 1, status = "available", pricePerNight }) {
    const res = await query(
      `INSERT INTO rooms (room_number, room_type_id, floor, status, price_per_night)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [roomNumber, roomTypeId, floor, status, pricePerNight]
    );
    return res.rows[0];
  },

  async update(id, { roomNumber, roomTypeId, floor, status, pricePerNight }) {
    const res = await query(
      `UPDATE rooms
       SET room_number = COALESCE($1, room_number),
           room_type_id = COALESCE($2, room_type_id),
           floor = COALESCE($3, floor),
           status = COALESCE($4, status),
           price_per_night = COALESCE($5, price_per_night)
       WHERE id = $6
       RETURNING *`,
      [roomNumber, roomTypeId, floor, status, pricePerNight, id]
    );
    return res.rows[0];
  },

  async updateStatus(id, status) {
    const res = await query(
      "UPDATE rooms SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return res.rows[0];
  },

  async delete(id) {
    const res = await query("DELETE FROM rooms WHERE id = $1 RETURNING id", [id]);
    return res.rows[0];
  },

  async hasActiveBookings(roomId) {
    const res = await query(
      `SELECT r.id FROM reservations r
       WHERE r.room_id = $1 AND r.status IN ('pending', 'confirmed')
       UNION
       SELECT c.id FROM check_in_out c
       WHERE c.room_id = $1 AND c.actual_check_out IS NULL
       LIMIT 1`,
      [roomId]
    );
    return res.rows.length > 0;
  },

  async getRoomTypes() {
    const res = await query("SELECT * FROM room_types ORDER BY base_price ASC");
    return res.rows;
  },
};

module.exports = Room;
