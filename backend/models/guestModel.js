const { query } = require("../config/db");

const Guest = {
  async getAll({ search, idType, nationality } = {}) {
    let sql = "SELECT * FROM guests WHERE 1=1";
    const params = [];

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      const exact = search.trim();
      params.push(term);
      const termIdx = params.length;

      params.push(exact);
      const exactIdx = params.length;

      sql += ` AND (
        first_name ILIKE $${termIdx} OR 
        last_name ILIKE $${termIdx} OR 
        CONCAT(first_name, ' ', last_name) ILIKE $${termIdx} OR
        phone ILIKE $${termIdx} OR 
        email ILIKE $${termIdx} OR 
        id_number ILIKE $${termIdx} OR
        CAST(id AS TEXT) = $${exactIdx}
      )`;
    }

    if (idType && idType !== "all") {
      params.push(idType);
      sql += ` AND id_type = $${params.length}`;
    }

    if (nationality && nationality !== "all") {
      params.push(nationality);
      sql += ` AND nationality = $${params.length}`;
    }

    sql += " ORDER BY created_at DESC";
    const res = await query(sql, params);
    return res.rows;
  },

  async getById(id) {
    const res = await query("SELECT * FROM guests WHERE id = $1", [id]);
    return res.rows[0];
  },

  async create({ firstName, lastName, email, phone, idType, idNumber, address, nationality = "Indian" }) {
    const res = await query(
      `INSERT INTO guests (first_name, last_name, email, phone, id_type, id_number, address, nationality)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [firstName, lastName, email || null, phone, idType || "Aadhar Card", idNumber, address || null, nationality || "Indian"]
    );
    return res.rows[0];
  },

  async update(id, fields) {
    const firstName = fields.firstName ?? fields.first_name;
    const lastName = fields.lastName ?? fields.last_name;
    const email = fields.email;
    const phone = fields.phone;
    const idType = fields.idType ?? fields.id_type;
    const idNumber = fields.idNumber ?? fields.id_number;
    const address = fields.address;
    const nationality = fields.nationality;

    const res = await query(
      `UPDATE guests
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           id_type = COALESCE($5, id_type),
           id_number = COALESCE($6, id_number),
           address = COALESCE($7, address),
           nationality = COALESCE($8, nationality)
       WHERE id = $9
       RETURNING *`,
      [firstName, lastName, email, phone, idType, idNumber, address, nationality, id]
    );
    return res.rows[0];
  },

  async getHistory(guestId) {
    const sql = `
      SELECT res.id AS reservation_id, res.room_id, r.room_number, rt.name AS room_type,
             res.check_in_date, res.check_out_date, res.number_of_guests,
             res.status AS reservation_status, res.total_amount, res.special_requests,
             res.created_at AS booked_at,
             cio.id AS check_in_out_id, cio.actual_check_in, cio.actual_check_out,
             cio.room_key_status
      FROM reservations res
      LEFT JOIN rooms r ON res.room_id = r.id
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN check_in_out cio ON res.id = cio.reservation_id
      WHERE res.guest_id = $1
      ORDER BY res.check_in_date DESC
    `;
    const res = await query(sql, [guestId]);
    return res.rows;
  },

  async hasActiveStayOrReservation(guestId) {
    const sql = `
      SELECT r.id FROM reservations r
      WHERE r.guest_id = $1 AND r.status IN ('pending', 'confirmed')
      UNION
      SELECT c.id FROM check_in_out c
      WHERE c.guest_id = $1 AND c.actual_check_out IS NULL
      LIMIT 1
    `;
    const res = await query(sql, [guestId]);
    return res.rows.length > 0;
  },

  async delete(id) {
    const res = await query("DELETE FROM guests WHERE id = $1 RETURNING id", [id]);
    return res.rows[0];
  },
};

module.exports = Guest;
