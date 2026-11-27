const { query, pool } = require("../config/db");

const VALID_CATEGORIES = [
  "utilities",
  "maintenance",
  "supplies",
  "food_beverage",
  "salaries",
  "other",
];

const VALID_PAYMENT_METHODS = [
  "cash",
  "upi",
  "credit_card",
  "debit_card",
  "bank_transfer",
];

const Expense = {
  VALID_CATEGORIES,
  VALID_PAYMENT_METHODS,

  /**
   * Retrieve all expenses with multi-field search, filters, sorting, and user name join.
   */
  async getAll({ search, category, paymentMethod, fromDate, toDate, sort } = {}) {
    let sql = `
      SELECT e.id,
             e.title,
             e.category,
             e.amount,
             e.payment_method,
             e.expense_date,
             e.description,
             e.recorded_by,
             e.created_at,
             u.full_name AS recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      params.push(s);
      sql += ` AND (
        e.title ILIKE $${params.length} OR 
        e.description ILIKE $${params.length} OR 
        e.category ILIKE $${params.length} OR 
        e.payment_method ILIKE $${params.length} OR
        CAST(e.id AS TEXT) ILIKE $${params.length}
      )`;
    }

    if (category && category !== "all") {
      params.push(category.toLowerCase());
      sql += ` AND e.category = $${params.length}`;
    }

    if (paymentMethod && paymentMethod !== "all") {
      params.push(paymentMethod.toLowerCase());
      sql += ` AND e.payment_method = $${params.length}`;
    }

    if (fromDate) {
      params.push(fromDate);
      sql += ` AND e.expense_date >= $${params.length}::date`;
    }

    if (toDate) {
      params.push(toDate);
      sql += ` AND e.expense_date <= $${params.length}::date`;
    }

    if (sort === "oldest") {
      sql += " ORDER BY e.expense_date ASC, e.id ASC";
    } else {
      sql += " ORDER BY e.expense_date DESC, e.id DESC";
    }

    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Get single expense by ID with joined staff name.
   */
  async getById(id) {
    const sql = `
      SELECT e.id,
             e.title,
             e.category,
             e.amount,
             e.payment_method,
             e.expense_date,
             e.description,
             e.recorded_by,
             e.created_at,
             u.full_name AS recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE e.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  },

  /**
   * Create an expense inside a PostgreSQL transaction with validations.
   */
  async create({
    title,
    category,
    amount,
    paymentMethod = "cash",
    expenseDate,
    description,
    recordedBy,
  }) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error("Amount must be a positive number greater than zero.");
    }

    const catLower = category ? category.toLowerCase().trim() : "";
    if (!VALID_CATEGORIES.includes(catLower)) {
      throw new Error(
        `Invalid category '${category}'. Allowed categories: ${VALID_CATEGORIES.join(", ")}`
      );
    }

    const methodLower = paymentMethod ? paymentMethod.toLowerCase().trim() : "cash";
    if (!VALID_PAYMENT_METHODS.includes(methodLower)) {
      throw new Error(
        `Invalid payment method '${paymentMethod}'. Allowed methods: ${VALID_PAYMENT_METHODS.join(", ")}`
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertSql = `
        INSERT INTO expenses (title, category, amount, payment_method, expense_date, description, recorded_by)
        VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7)
        RETURNING *
      `;
      const insertRes = await client.query(insertSql, [
        title.trim(),
        catLower,
        numAmount.toFixed(2),
        methodLower,
        expenseDate || null,
        description ? description.trim() : null,
        recordedBy || null,
      ]);

      const newExpense = insertRes.rows[0];

      await client.query("COMMIT");

      // Fetch with joined recorded_by_name
      return await this.getById(newExpense.id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Update an existing expense with validations and transactional integrity.
   */
  async update(id, { title, category, amount, paymentMethod, expenseDate, description }) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Expense with ID ${id} not found.`);
    }

    let updatedAmount = existing.amount;
    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error("Amount must be a positive number greater than zero.");
      }
      updatedAmount = numAmount.toFixed(2);
    }

    let updatedCategory = existing.category;
    if (category !== undefined) {
      const catLower = category.toLowerCase().trim();
      if (!VALID_CATEGORIES.includes(catLower)) {
        throw new Error(
          `Invalid category '${category}'. Allowed categories: ${VALID_CATEGORIES.join(", ")}`
        );
      }
      updatedCategory = catLower;
    }

    let updatedMethod = existing.payment_method;
    if (paymentMethod !== undefined) {
      const methodLower = paymentMethod.toLowerCase().trim();
      if (!VALID_PAYMENT_METHODS.includes(methodLower)) {
        throw new Error(
          `Invalid payment method '${paymentMethod}'. Allowed methods: ${VALID_PAYMENT_METHODS.join(", ")}`
        );
      }
      updatedMethod = methodLower;
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedDate = expenseDate !== undefined ? expenseDate : existing.expense_date;
    const updatedDesc = description !== undefined ? description : existing.description;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updateSql = `
        UPDATE expenses
        SET title = $1,
            category = $2,
            amount = $3,
            payment_method = $4,
            expense_date = $5::date,
            description = $6
        WHERE id = $7
        RETURNING *
      `;
      await client.query(updateSql, [
        updatedTitle,
        updatedCategory,
        updatedAmount,
        updatedMethod,
        updatedDate,
        updatedDesc,
        id,
      ]);

      await client.query("COMMIT");

      return await this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Delete an expense safely with verification.
   */
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Expense with ID ${id} not found.`);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM expenses WHERE id = $1", [id]);
      await client.query("COMMIT");
      return existing;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Comprehensive live KPI metrics aggregated directly in PostgreSQL.
   */
  async getStats() {
    const statsSql = `
      SELECT 
        COALESCE(SUM(amount), 0)::numeric AS total_amount,
        COUNT(*)::int AS total_count,
        COALESCE(SUM(CASE WHEN expense_date = CURRENT_DATE THEN amount ELSE 0 END), 0)::numeric AS today_amount,
        COUNT(CASE WHEN expense_date = CURRENT_DATE THEN 1 END)::int AS today_count,
        COALESCE(SUM(CASE WHEN expense_date >= DATE_TRUNC('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::numeric AS month_amount,
        COUNT(CASE WHEN expense_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)::int AS month_count,
        COALESCE(SUM(CASE WHEN expense_date >= DATE_TRUNC('year', CURRENT_DATE) THEN amount ELSE 0 END), 0)::numeric AS year_amount,
        COUNT(CASE WHEN expense_date >= DATE_TRUNC('year', CURRENT_DATE) THEN 1 END)::int AS year_count
      FROM expenses
    `;
    const statsRes = await query(statsSql);
    const summary = statsRes.rows[0];

    // Category summary
    const catSql = `
      SELECT category,
             COALESCE(SUM(amount), 0)::numeric AS total_amount,
             COUNT(*)::int AS expense_count
      FROM expenses
      GROUP BY category
      ORDER BY total_amount DESC
    `;
    const catRes = await query(catSql);

    const totalAmt = parseFloat(summary.total_amount) || 0;
    const categorySummary = catRes.rows.map((row) => {
      const catAmt = parseFloat(row.total_amount) || 0;
      const percentage = totalAmt > 0 ? ((catAmt / totalAmt) * 100).toFixed(1) : "0.0";
      return {
        category: row.category,
        total_amount: catAmt,
        count: parseInt(row.expense_count, 10),
        percentage: parseFloat(percentage),
      };
    });

    // Payment method breakdown
    const methodSql = `
      SELECT COALESCE(payment_method, 'cash') AS payment_method,
             COALESCE(SUM(amount), 0)::numeric AS total_amount,
             COUNT(*)::int AS count
      FROM expenses
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `;
    const methodRes = await query(methodSql);

    const methodTotals = {
      cash: 0,
      upi: 0,
      credit_card: 0,
      debit_card: 0,
      bank_transfer: 0,
    };
    methodRes.rows.forEach((r) => {
      const m = r.payment_method || "cash";
      if (methodTotals[m] !== undefined) {
        methodTotals[m] = parseFloat(r.total_amount) || 0;
      }
    });

    return {
      totalAmount: parseFloat(summary.total_amount) || 0,
      totalCount: parseInt(summary.total_count, 10) || 0,
      todayAmount: parseFloat(summary.today_amount) || 0,
      todayCount: parseInt(summary.today_count, 10) || 0,
      monthAmount: parseFloat(summary.month_amount) || 0,
      monthCount: parseInt(summary.month_count, 10) || 0,
      yearAmount: parseFloat(summary.year_amount) || 0,
      yearCount: parseInt(summary.year_count, 10) || 0,
      categorySummary,
      methodBreakdown: methodRes.rows.map((r) => ({
        method: r.payment_method,
        total_amount: parseFloat(r.total_amount) || 0,
        count: parseInt(r.count, 10),
      })),
      methodTotals,
    };
  },

  /**
   * Reports generator for daily, monthly, yearly, and category breakdowns.
   */
  async getReports({ period = "monthly", startDate, endDate, category } = {}) {
    let dateGroupExpr;
    if (period === "daily") {
      dateGroupExpr = "TO_CHAR(expense_date, 'YYYY-MM-DD')";
    } else if (period === "yearly") {
      dateGroupExpr = "TO_CHAR(expense_date, 'YYYY')";
    } else {
      // default monthly
      dateGroupExpr = "TO_CHAR(expense_date, 'YYYY-MM')";
    }

    let filterSql = "WHERE 1=1";
    const params = [];

    if (startDate) {
      params.push(startDate);
      filterSql += ` AND expense_date >= $${params.length}::date`;
    }

    if (endDate) {
      params.push(endDate);
      filterSql += ` AND expense_date <= $${params.length}::date`;
    }

    if (category && category !== "all") {
      params.push(category.toLowerCase());
      filterSql += ` AND category = $${params.length}`;
    }

    const timeSeriesSql = `
      SELECT ${dateGroupExpr} AS period_label,
             COALESCE(SUM(amount), 0)::numeric AS total_amount,
             COUNT(*)::int AS count
      FROM expenses
      ${filterSql}
      GROUP BY period_label
      ORDER BY period_label ASC
    `;
    const timeSeriesRes = await query(timeSeriesSql, params);

    const detailedSql = `
      SELECT e.id,
             e.title,
             e.category,
             e.amount,
             e.payment_method,
             e.expense_date,
             e.description,
             u.full_name AS recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      ${filterSql}
      ORDER BY e.expense_date DESC, e.id DESC
      LIMIT 200
    `;
    const detailedRes = await query(detailedSql, params);

    const totalReportAmount = detailedRes.rows.reduce(
      (sum, r) => sum + (parseFloat(r.amount) || 0),
      0
    );

    return {
      period,
      totalAmount: totalReportAmount,
      totalCount: detailedRes.rows.length,
      timeline: timeSeriesRes.rows.map((r) => ({
        label: r.period_label,
        total_amount: parseFloat(r.total_amount) || 0,
        count: parseInt(r.count, 10),
      })),
      records: detailedRes.rows,
    };
  },

  /**
   * Preserved for backward compatibility.
   */
  async getSummaryByCategory() {
    const res = await this.getStats();
    return res.categorySummary;
  },
};

module.exports = Expense;
