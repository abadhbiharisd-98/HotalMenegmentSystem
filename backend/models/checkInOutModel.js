const { query, getClient } = require("../config/db");

const CheckInOut = {
  /**
   * Safe transactional check-in
   * - Validates reservation exists & status is pending or confirmed
   * - Enforces no duplicate active check-in for the same reservation
   * - Verifies room is not currently occupied by another active stay
   * - Inserts check_in_out record
   * - Updates room status to 'occupied'
   * - Confirms reservation
   */
  async checkInTransaction({
    reservationId,
    roomKeyStatus = "issued",
    notes,
    handledBy,
    checkInTime,
  }) {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // 1. Lock and inspect reservation
      const resQuery = await client.query(
        `SELECT r.*, g.id AS g_id, g.first_name, g.last_name, rm.room_number, rm.status AS room_current_status
         FROM reservations r
         JOIN guests g ON r.guest_id = g.id
         JOIN rooms rm ON r.room_id = rm.id
         WHERE r.id = $1
         FOR UPDATE`,
        [reservationId]
      );

      if (resQuery.rows.length === 0) {
        const error = new Error("Reservation not found.");
        error.statusCode = 404;
        throw error;
      }

      const reservation = resQuery.rows[0];

      // 2. Prevent check-in for cancelled or completed reservations
      if (reservation.status === "cancelled") {
        const error = new Error("Cannot check in: Reservation has been cancelled.");
        error.statusCode = 400;
        throw error;
      }
      if (reservation.status === "completed") {
        const error = new Error("Cannot check in: Reservation has already been completed.");
        error.statusCode = 400;
        throw error;
      }

      // 3. Prevent duplicate check-in for the same reservation
      const existingStayQuery = await client.query(
        "SELECT id, actual_check_in FROM check_in_out WHERE reservation_id = $1 AND actual_check_out IS NULL",
        [reservationId]
      );
      if (existingStayQuery.rows.length > 0) {
        const error = new Error(
          `Reservation #${reservationId} is already checked in (Active Stay #${existingStayQuery.rows[0].id} since ${existingStayQuery.rows[0].actual_check_in}).`
        );
        error.statusCode = 409;
        throw error;
      }

      // 4. Verify room does not have an active stay by another guest
      const roomOccupancyQuery = await client.query(
        `SELECT cio.id, g.first_name, g.last_name
         FROM check_in_out cio
         JOIN guests g ON cio.guest_id = g.id
         WHERE cio.room_id = $1 AND cio.actual_check_out IS NULL`,
        [reservation.room_id]
      );
      if (roomOccupancyQuery.rows.length > 0) {
        const active = roomOccupancyQuery.rows[0];
        const error = new Error(
          `Room #${reservation.room_number} currently has an active stay registered to ${active.first_name} ${active.last_name} (Stay #${active.id}). Cannot check in until prior guest departs.`
        );
        error.statusCode = 400;
        throw error;
      }

      // 5. Insert check_in_out record
      const actualCheckInVal = checkInTime ? new Date(checkInTime) : new Date();
      const insertStayQuery = await client.query(
        `INSERT INTO check_in_out (reservation_id, guest_id, room_id, actual_check_in, room_key_status, notes, handled_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          reservationId,
          reservation.guest_id,
          reservation.room_id,
          actualCheckInVal,
          roomKeyStatus || "issued",
          notes || null,
          handledBy || null,
        ]
      );
      const stay = insertStayQuery.rows[0];

      // 6. Update room status to 'occupied'
      await client.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [reservation.room_id]);

      // 7. Update reservation status to 'confirmed'
      await client.query(
        "UPDATE reservations SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [reservationId]
      );

      await client.query("COMMIT");
      return stay;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Safe transactional checkout
   * - Verifies guest has actively checked in
   * - Records actual checkout timestamp
   * - Optionally settles remaining balance into payments table
   * - Updates reservation status to 'completed'
   * - Verifies safe room availability (only marks available if no other active stay exists)
   */
  async checkOutTransaction({
    reservationId,
    checkInOutId,
    roomKeyStatus = "returned",
    notes,
    handledBy,
    checkOutTime,
    settlePayment,
    paymentMethod = "cash",
    transactionId,
  }) {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // 1. Locate active stay
      let stayQuery;
      if (checkInOutId) {
        stayQuery = await client.query(
          "SELECT * FROM check_in_out WHERE id = $1 FOR UPDATE",
          [checkInOutId]
        );
      } else {
        stayQuery = await client.query(
          "SELECT * FROM check_in_out WHERE reservation_id = $1 AND actual_check_out IS NULL FOR UPDATE",
          [reservationId]
        );
      }

      if (stayQuery.rows.length === 0) {
        const error = new Error("No active check-in record found for this guest or reservation. Cannot checkout without check-in.");
        error.statusCode = 400;
        throw error;
      }

      const stay = stayQuery.rows[0];
      if (stay.actual_check_out) {
        const error = new Error(`Guest has already checked out from Stay #${stay.id} on ${stay.actual_check_out}.`);
        error.statusCode = 400;
        throw error;
      }

      const resId = stay.reservation_id;
      const roomId = stay.room_id;

      // 2. Fetch reservation to ensure valid link
      const resQuery = await client.query("SELECT * FROM reservations WHERE id = $1", [resId]);
      if (resQuery.rows.length === 0) {
        const error = new Error("Associated reservation not found.");
        error.statusCode = 404;
        throw error;
      }

      // 3. Optional settlement payment
      if (settlePayment && parseFloat(settlePayment) > 0) {
        let normMethod = String(paymentMethod).toLowerCase().trim();
        if (normMethod === "card" || normMethod === "credit card") normMethod = "credit_card";
        if (normMethod === "debit card") normMethod = "debit_card";
        if (normMethod === "bank transfer") normMethod = "bank_transfer";
        const validMethods = ["cash", "credit_card", "debit_card", "upi", "bank_transfer"];
        if (!validMethods.includes(normMethod)) normMethod = "cash";

        await client.query(
          `INSERT INTO payments (reservation_id, amount, payment_method, payment_status, transaction_id, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            resId,
            parseFloat(settlePayment),
            normMethod,
            "completed",
            transactionId || `OUT-${Date.now()}`,
            handledBy || null,
          ]
        );
      }

      // 4. Record actual check-out
      const actualOut = checkOutTime ? new Date(checkOutTime) : new Date();
      const updatedStayRes = await client.query(
        `UPDATE check_in_out
         SET actual_check_out = $1,
             room_key_status = COALESCE($2, 'returned'),
             notes = CASE WHEN $3::text IS NOT NULL THEN COALESCE(notes || ' | Checkout: ' || $3, 'Checkout: ' || $3) ELSE notes END,
             handled_by = COALESCE($4, handled_by)
         WHERE id = $5
         RETURNING *`,
        [actualOut, roomKeyStatus || "returned", notes || null, handledBy || null, stay.id]
      );
      const updatedStay = updatedStayRes.rows[0];

      // 5. Complete reservation
      await client.query(
        "UPDATE reservations SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [resId]
      );

      // 6. Safe room availability update:
      // "Update room status to AVAILABLE only when safe."
      // "Never mark a room available if another active stay exists."
      const otherStaysQuery = await client.query(
        "SELECT id FROM check_in_out WHERE room_id = $1 AND actual_check_out IS NULL AND id != $2",
        [roomId, stay.id]
      );

      if (otherStaysQuery.rows.length === 0) {
        // Room has no other active stays; verify not in maintenance
        const roomQuery = await client.query("SELECT status FROM rooms WHERE id = $1", [roomId]);
        if (roomQuery.rows.length > 0 && roomQuery.rows[0].status !== "maintenance") {
          await client.query("UPDATE rooms SET status = 'available' WHERE id = $1", [roomId]);
        }
      }

      await client.query("COMMIT");
      return updatedStay;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get all currently checked-in guests (active stays)
   */
  async getActiveStays({ search, roomId } = {}) {
    let sql = `
      SELECT 
        cio.id,
        cio.reservation_id,
        cio.guest_id,
        cio.room_id,
        cio.actual_check_in,
        cio.actual_check_out,
        cio.room_key_status,
        cio.notes,
        cio.handled_by,
        cio.created_at,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        g.id_type,
        g.id_number,
        g.address,
        g.nationality,
        r.room_number,
        r.floor,
        r.price_per_night,
        r.status AS room_status,
        rt.name AS room_type,
        rt.capacity,
        res.check_in_date,
        res.check_out_date,
        res.number_of_guests,
        res.total_amount,
        res.status AS reservation_status,
        res.special_requests,
        COALESCE((
          SELECT SUM(p.amount) 
          FROM payments p 
          WHERE p.reservation_id = res.id AND p.payment_status = 'completed'
        ), 0) AS total_paid
      FROM check_in_out cio
      JOIN reservations res ON cio.reservation_id = res.id
      JOIN guests g ON cio.guest_id = g.id
      JOIN rooms r ON cio.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE cio.actual_check_out IS NULL
    `;
    const params = [];

    if (roomId) {
      params.push(roomId);
      sql += ` AND cio.room_id = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      sql += ` AND (
        g.first_name ILIKE $${pIdx} OR
        g.last_name ILIKE $${pIdx} OR
        g.phone ILIKE $${pIdx} OR
        r.room_number ILIKE $${pIdx} OR
        CAST(cio.reservation_id AS TEXT) = $${pIdx}
      )`;
    }

    sql += " ORDER BY cio.actual_check_in DESC";
    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Get eligible confirmed/pending reservations ready for check-in
   */
  async getEligibleReservations({ search } = {}) {
    let sql = `
      SELECT 
        res.id,
        res.guest_id,
        res.room_id,
        res.check_in_date,
        res.check_out_date,
        res.number_of_guests,
        res.total_amount,
        res.status,
        res.special_requests,
        res.created_at,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        g.id_type,
        g.id_number,
        g.address,
        g.nationality,
        r.room_number,
        r.floor,
        r.price_per_night,
        r.status AS room_status,
        rt.name AS room_type,
        rt.capacity,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.reservation_id = res.id AND p.payment_status = 'completed'
        ), 0) AS total_paid
      FROM reservations res
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE res.status IN ('confirmed', 'pending')
        AND NOT EXISTS (
          SELECT 1 FROM check_in_out cio
          WHERE cio.reservation_id = res.id AND cio.actual_check_out IS NULL
        )
    `;
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      sql += ` AND (
        g.first_name ILIKE $${pIdx} OR
        g.last_name ILIKE $${pIdx} OR
        g.phone ILIKE $${pIdx} OR
        r.room_number ILIKE $${pIdx} OR
        CAST(res.id AS TEXT) = $${pIdx}
      )`;
    }

    sql += " ORDER BY res.check_in_date ASC, res.id ASC";
    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Get check-in and checkout history (both active and completed stays)
   */
  async getHistory({ search, status, startDate, endDate, limit = 150 } = {}) {
    let sql = `
      SELECT 
        cio.id,
        cio.reservation_id,
        cio.guest_id,
        cio.room_id,
        cio.actual_check_in,
        cio.actual_check_out,
        cio.room_key_status,
        cio.notes,
        cio.handled_by,
        cio.created_at,
        CASE 
          WHEN cio.actual_check_out IS NULL THEN 'active'
          ELSE 'completed'
        END AS stay_status,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        g.id_type,
        g.id_number,
        r.room_number,
        r.floor,
        rt.name AS room_type,
        res.check_in_date,
        res.check_out_date,
        res.total_amount,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.reservation_id = res.id AND p.payment_status = 'completed'
        ), 0) AS total_paid
      FROM check_in_out cio
      JOIN reservations res ON cio.reservation_id = res.id
      JOIN guests g ON cio.guest_id = g.id
      JOIN rooms r ON cio.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE 1=1
    `;
    const params = [];

    if (status === "active") {
      sql += " AND cio.actual_check_out IS NULL";
    } else if (status === "completed") {
      sql += " AND cio.actual_check_out IS NOT NULL";
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND DATE(cio.actual_check_in) >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      sql += ` AND DATE(cio.actual_check_in) <= $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      sql += ` AND (
        g.first_name ILIKE $${pIdx} OR
        g.last_name ILIKE $${pIdx} OR
        g.phone ILIKE $${pIdx} OR
        r.room_number ILIKE $${pIdx} OR
        CAST(cio.reservation_id AS TEXT) = $${pIdx}
      )`;
    }

    sql += ` ORDER BY cio.actual_check_in DESC LIMIT ${parseInt(limit, 10) || 150}`;
    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Get summary metrics for check-in/out hub
   */
  async getSummaryMetrics() {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM check_in_out WHERE actual_check_out IS NULL) AS active_stays,
        (SELECT COUNT(*) FROM check_in_out WHERE DATE(actual_check_in) = CURRENT_DATE) AS today_check_ins,
        (SELECT COUNT(*) FROM check_in_out WHERE DATE(actual_check_out) = CURRENT_DATE) AS today_check_outs,
        (SELECT COUNT(*) 
         FROM reservations r 
         WHERE r.status IN ('confirmed', 'pending')
           AND r.check_in_date <= CURRENT_DATE
           AND NOT EXISTS (
             SELECT 1 FROM check_in_out cio WHERE cio.reservation_id = r.id AND cio.actual_check_out IS NULL
           )
        ) AS pending_arrivals
    `;
    const res = await query(sql);
    const row = res.rows[0];
    return {
      activeStays: parseInt(row.active_stays || 0, 10),
      todayCheckIns: parseInt(row.today_check_ins || 0, 10),
      todayCheckOuts: parseInt(row.today_check_outs || 0, 10),
      pendingArrivals: parseInt(row.pending_arrivals || 0, 10),
    };
  },

  /**
   * Find stay record by reservation ID
   */
  async getByReservationId(reservationId) {
    const sql = `
      SELECT 
        cio.*,
        g.first_name, g.last_name, g.phone, g.email, g.id_type, g.id_number,
        r.room_number, r.floor, rt.name AS room_type,
        res.check_in_date, res.check_out_date, res.total_amount
      FROM check_in_out cio
      JOIN reservations res ON cio.reservation_id = res.id
      JOIN guests g ON cio.guest_id = g.id
      JOIN rooms r ON cio.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE cio.reservation_id = $1
      ORDER BY cio.id DESC
      LIMIT 1
    `;
    const res = await query(sql, [reservationId]);
    return res.rows[0];
  },
};

module.exports = CheckInOut;
