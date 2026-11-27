const { query, getClient } = require("../config/db");

const Invoice = {
  /**
   * Safe transactional invoice generation
   * - Enforces 1 invoice per reservation (Rule #9 & Unique constraint)
   * - Reconciles actual payments recorded in payments table without duplicate payment creation
   * - Sets payment_status to 'paid', 'partial', or 'unpaid'
   * - Calculates nights and room charges from stay dates
   */
  async generateInvoiceTransaction({
    reservationId,
    taxPercent = 0,
    discountAmount = 0,
    dueDate,
  }) {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // 1. Check if an invoice already exists for this reservation
      const existingInvQuery = await client.query(
        "SELECT id, invoice_number FROM invoices WHERE reservation_id = $1",
        [reservationId]
      );
      if (existingInvQuery.rows.length > 0) {
        const error = new Error(
          `Invoice ${existingInvQuery.rows[0].invoice_number} has already been generated for Reservation #${reservationId}. Duplicate invoices are strictly prohibited.`
        );
        error.statusCode = 409;
        throw error;
      }

      // 2. Fetch reservation, guest, room, and check_in_out details
      const resQuery = await client.query(
        `SELECT 
          r.*, 
          g.first_name, g.last_name, g.phone, g.email, g.id_type, g.id_number,
          rm.room_number, rm.price_per_night,
          rt.name AS room_type,
          cio.actual_check_in, cio.actual_check_out
         FROM reservations r
         JOIN guests g ON r.guest_id = g.id
         JOIN rooms rm ON r.room_id = rm.id
         JOIN room_types rt ON rm.room_type_id = rt.id
         LEFT JOIN check_in_out cio ON cio.reservation_id = r.id
         WHERE r.id = $1
         FOR UPDATE OF r`,
        [reservationId]
      );

      if (resQuery.rows.length === 0) {
        const error = new Error("Reservation not found.");
        error.statusCode = 404;
        throw error;
      }

      const reservation = resQuery.rows[0];

      // 3. Calculate billable nights
      const inDate = new Date(reservation.check_in_date);
      const outDate = new Date(reservation.check_out_date);
      const diffDays = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
      const billableNights = Math.max(1, diffDays);

      // Subtotal from room charges
      const pricePerNight = parseFloat(reservation.price_per_night || 0);
      const calculatedSubtotal = billableNights * pricePerNight;
      const subtotal = parseFloat(reservation.total_amount) || calculatedSubtotal;

      // Discounts
      const discount = Math.max(0, parseFloat(discountAmount) || 0);
      const taxableAmount = Math.max(0, subtotal - discount);

      // Tax calculation (taxPercent defaults to 0% if unconfigured)
      const taxRate = Math.max(0, parseFloat(taxPercent) || 0);
      const taxAmount = (taxableAmount * taxRate) / 100;

      // Grand total
      const totalAmount = taxableAmount + taxAmount;

      // 4. Reconcile with actual completed payments from payments table (Rule #10: NEVER insert duplicate payment)
      const payQuery = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM payments
         WHERE reservation_id = $1 AND payment_status = 'completed'`,
        [reservationId]
      );
      const totalPaid = parseFloat(payQuery.rows[0].total_paid || 0);

      // Determine payment status
      let paymentStatus = "unpaid";
      if (totalPaid >= totalAmount && totalAmount > 0) {
        paymentStatus = "paid";
      } else if (totalPaid > 0) {
        paymentStatus = "partial";
      }

      // 5. Unique invoice number: INV-YYYYMMDD-<reservationId>-<seq>
      const today = new Date();
      const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, "");
      const invoiceNumber = `INV-${datePrefix}-RES${reservationId}`;

      // 6. Insert into invoices table
      const insertResult = await client.query(
        `INSERT INTO invoices (
          reservation_id, 
          invoice_number, 
          subtotal, 
          tax_amount, 
          discount_amount, 
          total_amount, 
          payment_status, 
          invoice_date,
          due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, $8)
        RETURNING *`,
        [
          reservationId,
          invoiceNumber,
          subtotal,
          taxAmount,
          discount,
          totalAmount,
          paymentStatus,
          dueDate || null,
        ]
      );

      const createdInvoice = insertResult.rows[0];

      await client.query("COMMIT");
      return createdInvoice;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Directory listing with search and filters
   */
  async getAll({ search, paymentStatus, startDate, endDate, sortBy = "latest", limit = 200 } = {}) {
    let sql = `
      SELECT 
        inv.id,
        inv.reservation_id,
        inv.invoice_number,
        inv.subtotal,
        inv.tax_amount,
        inv.discount_amount,
        inv.total_amount,
        inv.payment_status,
        inv.invoice_date,
        inv.due_date,
        inv.created_at,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        r.room_number,
        r.floor,
        rt.name AS room_type,
        res.check_in_date,
        res.check_out_date,
        res.status AS reservation_status,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.reservation_id = inv.reservation_id AND p.payment_status = 'completed'
        ), 0) AS total_paid
      FROM invoices inv
      JOIN reservations res ON inv.reservation_id = res.id
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE 1=1
    `;
    const params = [];

    if (paymentStatus && paymentStatus !== "all") {
      params.push(paymentStatus);
      sql += ` AND inv.payment_status = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND inv.invoice_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      sql += ` AND inv.invoice_date <= $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      sql += ` AND (
        inv.invoice_number ILIKE $${pIdx} OR
        g.first_name ILIKE $${pIdx} OR
        g.last_name ILIKE $${pIdx} OR
        g.phone ILIKE $${pIdx} OR
        r.room_number ILIKE $${pIdx} OR
        CAST(inv.id AS TEXT) = $${pIdx} OR
        CAST(inv.reservation_id AS TEXT) = $${pIdx}
      )`;
    }

    if (sortBy === "oldest") {
      sql += ` ORDER BY inv.created_at ASC LIMIT ${parseInt(limit, 10) || 200}`;
    } else {
      sql += ` ORDER BY inv.created_at DESC LIMIT ${parseInt(limit, 10) || 200}`;
    }

    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Get single invoice by ID with complete guest folio, stay dates, and payment history
   */
  async getById(id) {
    const sql = `
      SELECT 
        inv.*,
        g.id AS guest_id,
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
        rt.name AS room_type,
        res.check_in_date,
        res.check_out_date,
        res.number_of_guests,
        res.status AS reservation_status,
        cio.actual_check_in,
        cio.actual_check_out,
        cio.room_key_status,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.reservation_id = inv.reservation_id AND p.payment_status = 'completed'
        ), 0) AS total_paid
      FROM invoices inv
      JOIN reservations res ON inv.reservation_id = res.id
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN check_in_out cio ON cio.reservation_id = res.id
      WHERE inv.id = $1
    `;
    const res = await query(sql, [id]);
    if (res.rows.length === 0) return null;

    const invoice = res.rows[0];

    // Fetch associated payment ledger entries
    const paymentsSql = `
      SELECT id, amount, payment_method, payment_status, transaction_id, payment_date
      FROM payments
      WHERE reservation_id = $1
      ORDER BY payment_date ASC
    `;
    const paymentsRes = await query(paymentsSql, [invoice.reservation_id]);
    invoice.payments = paymentsRes.rows;

    return invoice;
  },

  /**
   * Get invoice by reservation ID
   */
  async getByReservation(reservationId) {
    const sql = `
      SELECT inv.*, g.first_name, g.last_name, r.room_number
      FROM invoices inv
      JOIN reservations res ON inv.reservation_id = res.id
      JOIN guests g ON res.guest_id = g.id
      JOIN rooms r ON res.room_id = r.id
      WHERE inv.reservation_id = $1
    `;
    const res = await query(sql, [reservationId]);
    return res.rows[0];
  },

  /**
   * Get billing dashboard KPI metrics
   */
  async getStats() {
    const sql = `
      SELECT 
        COUNT(*) AS total_invoices,
        COALESCE(SUM(total_amount), 0) AS total_billed,
        COALESCE(SUM(CASE WHEN invoice_date = CURRENT_DATE THEN total_amount ELSE 0 END), 0) AS today_billed,
        COALESCE(SUM(CASE 
          WHEN EXTRACT(MONTH FROM invoice_date) = EXTRACT(MONTH FROM CURRENT_DATE) 
           AND EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE) 
          THEN total_amount ELSE 0 END), 0) AS monthly_billed,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) AS count_paid,
        COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) AS count_partial,
        COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) AS count_unpaid
      FROM invoices
    `;
    const res = await query(sql);
    const row = res.rows[0];

    // Calculate outstanding balance across all invoices (total_amount - total_paid)
    const balSql = `
      SELECT 
        COALESCE(SUM(GREATEST(0, inv.total_amount - COALESCE(p.paid, 0))), 0) AS outstanding_balance
      FROM invoices inv
      LEFT JOIN (
        SELECT reservation_id, SUM(amount) AS paid
        FROM payments
        WHERE payment_status = 'completed'
        GROUP BY reservation_id
      ) p ON inv.reservation_id = p.reservation_id
    `;
    const balRes = await query(balSql);

    return {
      totalInvoices: parseInt(row.total_invoices || 0, 10),
      totalBilled: parseFloat(row.total_billed || 0),
      todayBilled: parseFloat(row.today_billed || 0),
      monthlyBilled: parseFloat(row.monthly_billed || 0),
      countPaid: parseInt(row.count_paid || 0, 10),
      countPartial: parseInt(row.count_partial || 0, 10),
      countUnpaid: parseInt(row.count_unpaid || 0, 10),
      outstandingBalance: parseFloat(balRes.rows[0].outstanding_balance || 0),
    };
  },

  /**
   * Get reservations eligible for automatic invoice generation (no invoice generated yet)
   */
  async getEligibleReservations({ search } = {}) {
    let sql = `
      SELECT 
        r.id AS reservation_id,
        r.check_in_date,
        r.check_out_date,
        r.total_amount AS booking_total,
        r.status AS reservation_status,
        g.first_name,
        g.last_name,
        g.phone,
        g.email,
        rm.room_number,
        rm.price_per_night,
        rt.name AS room_type,
        cio.actual_check_in,
        cio.actual_check_out,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          WHERE p.reservation_id = r.id AND p.payment_status = 'completed'
        ), 0) AS total_paid
      FROM reservations r
      JOIN guests g ON r.guest_id = g.id
      JOIN rooms rm ON r.room_id = rm.id
      JOIN room_types rt ON rm.room_type_id = rt.id
      LEFT JOIN check_in_out cio ON cio.reservation_id = r.id
      WHERE r.status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM invoices inv WHERE inv.reservation_id = r.id
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
        rm.room_number ILIKE $${pIdx} OR
        CAST(r.id AS TEXT) = $${pIdx}
      )`;
    }

    sql += " ORDER BY r.id DESC LIMIT 100";
    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Update payment status of an invoice
   */
  async updatePaymentStatus(id, status) {
    const validStatuses = ["unpaid", "partial", "paid"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(", ")}`);
    }
    const res = await query(
      "UPDATE invoices SET payment_status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return res.rows[0];
  },
};

module.exports = Invoice;
