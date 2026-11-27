const { Pool } = require("pg");
require("dotenv").config();

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "hotel_management",
  max: 20, // maximum connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err.message);
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for transactions
 */
const getClient = () => pool.connect();

/**
 * Test database connectivity
 */
const testConnection = async () => {
  try {
    const res = await pool.query("SELECT NOW() as current_time, current_database() as database, current_user as user;");
    return {
      connected: true,
      time: res.rows[0].current_time,
      database: res.rows[0].database,
      user: res.rows[0].user,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
    };
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
};
