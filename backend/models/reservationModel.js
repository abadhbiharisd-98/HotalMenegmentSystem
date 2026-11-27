const { query } = require("../config/db");

const Reservation = {
  async getAll({ status, search, fromDate, toDate } = {}) {
    let sql = `
      SELECT res.id, res.check_in_date, res.check_out_date, res.number_of_guests,
             res.status, res.total_amount, res.special_requests, res.created_at, res.updated_at,
             g.id AS guest_id, g.first_name, g.last_name, g.phone, g.email, g.id_type, g.id_number,
             r.id AS room_id, r.room_number, r.floor, r.price_per_night,
             rt.id AS room_type_id, rt.name AS room_type,
             COALESCE((
               SELECT SUM(p.amount) FROM payments p 
               WHERE p.reservation_id = res.id AND p.payment_status = 'completed'
             ), 0.00) AS total_paid,
             cio.actual_check_in, cio.actual_check_out, cio.room_key_status
      FROM reservations res
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN check_in_out cio ON res.id = cio.reservation_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      params.push(status);
      sql += ` AND res.status = $${params.length}`;
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      const exact = search.trim();
      params.push(term);
      const termIdx = params.length;
      params.push(exact);
      const exactIdx = params.length;

      sql += ` AND (
        g.first_name ILIKE $${termIdx} OR
        g.last_name ILIKE $${termIdx} OR
        CONCAT(g.first_name, ' ', g.last_name) ILIKE $${termIdx} OR
        g.phone ILIKE $${termIdx} OR
        r.room_number ILIKE $${termIdx} OR
        CAST(res.id AS TEXT) = $${exactIdx}
      )`;
    }

    if (fromDate) {
      params.push(fromDate);
      sql += ` AND res.check_in_date >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      sql += ` AND res.check_out_date <= $${params.length}`;
    }

    sql += " ORDER BY res.created_at DESC";
    const res = await query(sql, params);
    return res.rows;
  },

  async getById(id) {
    const sql = `
      SELECT res.id, res.check_in_date, res.check_out_date, res.number_of_guests,
             res.status, res.total_amount, res.special_requests, res.created_at, res.updated_at,
             g.id AS guest_id, g.first_name, g.last_name, g.phone, g.email, g.id_type, g.id_number, g.address, g.nationality,
             r.id AS room_id, r.room_number, r.floor, r.price_per_night, rt.id AS room_type_id, rt.name AS room_type,
             COALESCE((
               SELECT SUM(p.amount) FROM payments p 
               WHERE p.reservation_id = res.id AND p.payment_status = 'completed'
             ), 0.00) AS total_paid,
             cio.actual_check_in, cio.actual_check_out, cio.room_key_status
      FROM reservations res
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN check_in_out cio ON res.id = cio.reservation_id
      WHERE res.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0];
  },

  async checkConflict(roomId, checkInDate, checkOutDate, excludeReservationId = null) {
    const sql = `
      SELECT res.id, res.check_in_date, res.check_out_date, res.status,
             r.room_number
      FROM reservations res
      JOIN rooms r ON res.room_id = r.id
      WHERE res.room_id = $1
        AND res.status IN ('pending', 'confirmed')
        AND res.check_in_date < $3
        AND res.check_out_date > $2
        AND ($4::INT IS NULL OR res.id != $4)
      LIMIT 1
    `;
    const res = await query(sql, [roomId, checkInDate, checkOutDate, excludeReservationId]);
    return res.rows[0];
  },

  async getAvailableRooms(checkInDate, checkOutDate, roomTypeId = null) {
    let sql = `
      SELECT r.id, r.room_number, r.floor, r.status, r.price_per_night,
             rt.id AS room_type_id, rt.name AS room_type, rt.capacity, rt.amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.status != 'maintenance'
        AND r.id NOT IN (
          SELECT room_id FROM reservations
          WHERE status IN ('pending', 'confirmed')
            AND check_in_date < $2
            AND check_out_date > $1
        )
    `;
    const params = [checkInDate, checkOutDate];

    if (roomTypeId && roomTypeId !== "all") {
      params.push(roomTypeId);
      sql += ` AND r.room_type_id = $${params.length}`;
    }

    sql += " ORDER BY r.room_number ASC";
    const res = await query(sql, params);
    return res.rows;
  },

  async create({ guestId, roomId, checkInDate, checkOutDate, numberOfGuests, totalAmount, specialRequests, createdBy }) {
    const res = await query(
      `INSERT INTO reservations (guest_id, room_id, check_in_date, check_out_date, number_of_guests, total_amount, special_requests, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [guestId, roomId, checkInDate, checkOutDate, numberOfGuests, totalAmount, specialRequests, createdBy]
    );
    return res.rows[0];
  },

  async update(id, { roomId, checkInDate, checkOutDate, numberOfGuests, totalAmount, specialRequests }) {
    const res = await query(
      `UPDATE reservations
       SET room_id = COALESCE($1, room_id),
           check_in_date = COALESCE($2, check_in_date),
           check_out_date = COALESCE($3, check_out_date),
           number_of_guests = COALESCE($4, number_of_guests),
           total_amount = COALESCE($5, total_amount),
           special_requests = COALESCE($6, special_requests),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [roomId, checkInDate, checkOutDate, numberOfGuests, totalAmount, specialRequests, id]
    );
    return res.rows[0];
  },

  async updateStatus(id, status) {
    const res = await query(
      `UPDATE reservations
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return res.rows[0];
  },

  async delete(id) {
    const res = await query("DELETE FROM reservations WHERE id = $1 RETURNING id", [id]);
    return res.rows[0];
  },
};

module.exports = Reservation;
