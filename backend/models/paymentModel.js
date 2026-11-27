const { query, getClient } = require("../config/db");

// Helper to normalize payment method to match check constraint
function normalizeMethod(method) {
  let norm = String(method || "cash").toLowerCase().trim();
  if (norm === "card" || norm === "credit card") norm = "credit_card";
  if (norm === "debit card") norm = "debit_card";
  if (norm === "bank transfer" || norm === "net banking" || norm === "neft") norm = "bank_transfer";
  const validMethods = ["cash", "credit_card", "debit_card", "upi", "bank_transfer"];
  return validMethods.includes(norm) ? norm : "cash";
}

const Payment = {
  /**
   * Backwards-compatible create method used across reservation and checkout controllers
   */
  async create({ reservationId, amount, paymentMethod, paymentStatus = "completed", transactionId, recordedBy }) {
    const validMethod = normalizeMethod(paymentMethod);
    const validStatus = ["pending", "completed", "failed", "refunded"].includes(paymentStatus)
      ? paymentStatus
      : "completed";

    const res = await query(
      `INSERT INTO payments (reservation_id, amount, payment_method, payment_status, transaction_id, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [reservationId, parseFloat(amount), validMethod, validStatus, transactionId || null, recordedBy || null]
    );
    return res.rows[0];
  },

  /**
   * Safe transactional payment creation with overpayment validation
   */
  async recordPaymentTransaction({
    reservationId,
    amount,
    paymentMethod,
    transactionId,
    recordedBy,
    notes,
  }) {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // 1. Lock and inspect reservation
      const resQuery = await client.query(
        `SELECT r.*, g.first_name, g.last_name
         FROM reservations r
         JOIN guests g ON r.guest_id = g.id
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

      // 2. Validate payment amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        const error = new Error("Payment amount must be greater than zero.");
        error.statusCode = 400;
        throw error;
      }

      // 3. Compute current paid amount and remaining balance
      const paidQuery = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM payments
         WHERE reservation_id = $1 AND payment_status = 'completed'`,
        [reservationId]
      );
      const totalPaid = parseFloat(paidQuery.rows[0].total_paid || 0);
      const totalBill = parseFloat(reservation.total_amount || 0);
      const outstandingBalance = Math.max(0, totalBill - totalPaid);

      // 4. Overpayment & Zero-balance safeguard
      if (outstandingBalance <= 0) {
        const error = new Error(
          "This reservation folio is already fully settled (Remaining balance is ₹0.00). Cannot accept additional payments."
        );
        error.statusCode = 400;
        throw error;
      }

      if (numAmount > outstandingBalance) {
        const error = new Error(
          `Payment of ₹${numAmount.toFixed(2)} exceeds the remaining outstanding balance of ₹${outstandingBalance.toFixed(2)}.`
        );
        error.statusCode = 400;
        throw error;
      }

      // 5. Construct transaction reference & notes
      const validMethod = normalizeMethod(paymentMethod);
      const finalTxId = notes && notes.trim()
        ? `${transactionId || `PAY-${Date.now()}`} | Notes: ${notes.trim()}`
        : transactionId || `PAY-${Date.now()}`;

      // 6. Insert into payments table
      const insertResult = await client.query(
        `INSERT INTO payments (reservation_id, amount, payment_method, payment_status, transaction_id, recorded_by)
         VALUES ($1, $2, $3, 'completed', $4, $5)
         RETURNING *`,
        [reservationId, numAmount, validMethod, finalTxId, recordedBy || null]
      );
      const paymentRecord = insertResult.rows[0];

      await client.query("COMMIT");
      return paymentRecord;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Safe transactional refund workflow
   */
  async processRefundTransaction({ paymentId, reason, refundedBy }) {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // 1. Lock payment record
      const payQuery = await client.query(
        "SELECT * FROM payments WHERE id = $1 FOR UPDATE",
        [paymentId]
      );

      if (payQuery.rows.length === 0) {
        const error = new Error("Payment record not found.");
        error.statusCode = 404;
        throw error;
      }

      const payment = payQuery.rows[0];

      if (payment.payment_status === "refunded") {
        const error = new Error(`Payment #${paymentId} has already been refunded.`);
        error.statusCode = 400;
        throw error;
      }

      if (payment.payment_status !== "completed") {
        const error = new Error(`Cannot refund payment #${paymentId}: Status is '${payment.payment_status}'. Only completed payments can be refunded.`);
        error.statusCode = 400;
        throw error;
      }

      // 2. Update status to 'refunded' and append audit note
      const refundAuditTag = reason && reason.trim()
        ? `[REFUNDED: ${reason.trim()}]`
        : "[REFUNDED]";

      const updatedTxId = payment.transaction_id
        ? `${payment.transaction_id} ${refundAuditTag}`
        : refundAuditTag;

      const updateRes = await client.query(
        `UPDATE payments
         SET payment_status = 'refunded',
             transaction_id = $1,
             recorded_by = COALESCE($2, recorded_by)
         WHERE id = $3
         RETURNING *`,
        [updatedTxId, refundedBy || null, paymentId]
      );

      await client.query("COMMIT");
      return updateRes.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Directory listing with multi-field search and filters
   */
  async getAll({ search, method, status, startDate, endDate, sortBy = "latest", limit = 200 } = {}) {
    let sql = `
      SELECT 
        p.id,
        p.reservation_id,
        p.amount,
        p.payment_method,
        p.payment_status,
        p.transaction_id,
        p.payment_date,
        p.recorded_by,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        r.room_number,
        r.floor,
        rt.name AS room_type,
        res.check_in_date,
        res.check_out_date,
        res.total_amount AS booking_total,
        res.status AS reservation_status,
        u.full_name AS recorded_by_name
      FROM payments p
      JOIN reservations res ON p.reservation_id = res.id
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (method && method !== "all") {
      params.push(method);
      sql += ` AND p.payment_method = $${params.length}`;
    }

    if (status && status !== "all") {
      params.push(status);
      sql += ` AND p.payment_status = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND DATE(p.payment_date) >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      sql += ` AND DATE(p.payment_date) <= $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      sql += ` AND (
        g.first_name ILIKE $${pIdx} OR
        g.last_name ILIKE $${pIdx} OR
        g.phone ILIKE $${pIdx} OR
        r.room_number ILIKE $${pIdx} OR
        CAST(p.id AS TEXT) = $${pIdx} OR
        CAST(p.reservation_id AS TEXT) = $${pIdx} OR
        p.transaction_id ILIKE $${pIdx}
      )`;
    }

    if (sortBy === "oldest") {
      sql += ` ORDER BY p.payment_date ASC LIMIT ${parseInt(limit, 10) || 200}`;
    } else {
      sql += ` ORDER BY p.payment_date DESC LIMIT ${parseInt(limit, 10) || 200}`;
    }

    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Get single payment by ID with full receipt folio
   */
  async getById(id) {
    const sql = `
      SELECT 
        p.id,
        p.reservation_id,
        p.amount,
        p.payment_method,
        p.payment_status,
        p.transaction_id,
        p.payment_date,
        p.recorded_by,
        g.id AS guest_id,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        g.id_type,
        g.id_number,
        g.address,
        r.room_number,
        r.floor,
        rt.name AS room_type,
        res.check_in_date,
        res.check_out_date,
        res.total_amount AS booking_total,
        res.status AS reservation_status,
        u.full_name AS recorded_by_name,
        (
          SELECT COALESCE(SUM(p2.amount), 0)
          FROM payments p2
          WHERE p2.reservation_id = p.reservation_id AND p2.payment_status = 'completed'
        ) AS total_paid_so_far
      FROM payments p
      JOIN reservations res ON p.reservation_id = res.id
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0];
  },

  /**
   * Get payments for a specific reservation
   */
  async getByReservation(reservationId) {
    const sql = `
      SELECT p.*, u.full_name AS recorded_by_name
      FROM payments p
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.reservation_id = $1
      ORDER BY p.payment_date DESC
    `;
    const res = await query(sql, [reservationId]);
    return res.rows;
  },

  /**
   * Get live Payment Dashboard KPI metrics
   */
  async getStats() {
    const metricsSql = `
      SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) AS total_received,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' AND DATE(payment_date) = CURRENT_DATE THEN amount ELSE 0 END), 0) AS today_collections,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' 
          AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE) 
          AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE) THEN amount ELSE 0 END), 0) AS monthly_collections,
        COALESCE(SUM(CASE WHEN payment_status = 'refunded' THEN amount ELSE 0 END), 0) AS total_refunds,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) AS count_completed,
        COUNT(CASE WHEN payment_status = 'refunded' THEN 1 END) AS count_refunded
      FROM payments
    `;
    const metricsRes = await query(metricsSql);
    const m = metricsRes.rows[0];

    // Method breakdown
    const methodSql = `
      SELECT 
        payment_method,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
      FROM payments
      WHERE payment_status = 'completed'
      GROUP BY payment_method
    `;
    const methodRes = await query(methodSql);

    const methods = {
      cash: 0,
      upi: 0,
      credit_card: 0,
      debit_card: 0,
      bank_transfer: 0,
    };
    methodRes.rows.forEach((row) => {
      methods[row.payment_method] = parseFloat(row.total || 0);
    });

    // Pending balances calculation across active bookings
    const pendingSql = `
      SELECT 
        COALESCE(SUM(GREATEST(0, r.total_amount - COALESCE(p.paid, 0))), 0) AS total_pending
      FROM reservations r
      LEFT JOIN (
        SELECT reservation_id, SUM(amount) AS paid
        FROM payments
        WHERE payment_status = 'completed'
        GROUP BY reservation_id
      ) p ON r.id = p.reservation_id
      WHERE r.status IN ('confirmed', 'pending')
    `;
    const pendingRes = await query(pendingSql);
    const totalPending = parseFloat(pendingRes.rows[0].total_pending || 0);

    return {
      totalReceived: parseFloat(m.total_received || 0),
      todayCollections: parseFloat(m.today_collections || 0),
      monthlyCollections: parseFloat(m.monthly_collections || 0),
      totalRefunds: parseFloat(m.total_refunds || 0),
      pendingBalances: totalPending,
      countCompleted: parseInt(m.count_completed || 0, 10),
      countRefunded: parseInt(m.count_refunded || 0, 10),
      methodTotals: methods,
    };
  },

  /**
   * Reservations with outstanding balances for new payment creation
   */
  async getPendingReservations({ search } = {}) {
    let sql = `
      SELECT 
        r.id AS reservation_id,
        r.total_amount AS booking_total,
        r.status AS reservation_status,
        r.check_in_date,
        r.check_out_date,
        g.id AS guest_id,
        g.first_name,
        g.last_name,
        g.phone,
        rm.room_number,
        rt.name AS room_type,
        COALESCE(p.paid, 0) AS total_paid,
        GREATEST(0, r.total_amount - COALESCE(p.paid, 0)) AS outstanding_balance
      FROM reservations r
      JOIN guests g ON r.guest_id = g.id
      JOIN rooms rm ON r.room_id = rm.id
      JOIN room_types rt ON rm.room_type_id = rt.id
      LEFT JOIN (
        SELECT reservation_id, SUM(amount) AS paid
        FROM payments
        WHERE payment_status = 'completed'
        GROUP BY reservation_id
      ) p ON r.id = p.reservation_id
      WHERE r.status != 'cancelled'
        AND GREATEST(0, r.total_amount - COALESCE(p.paid, 0)) > 0
    `;
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      sql += ` AND (
        g.first_name ILIKE $${pIdx} OR
        g.last_name ILIKE $${pIdx} OR
        g.phone ILIKE $${pIdx} OR
        rm.room_number ILIKE $${pIdx} OR
        CAST(r.id AS TEXT) = $${pIdx}
      )`;
    }

    sql += " ORDER BY r.id DESC LIMIT 100";
    const res = await query(sql, params);
    return res.rows;
  },
};

module.exports = Payment;
