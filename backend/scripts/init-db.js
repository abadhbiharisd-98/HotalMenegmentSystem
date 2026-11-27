const fs = require("fs");
const path = require("path");
const { pool, testConnection } = require("../config/db");

async function initDatabase() {
  console.log("Checking database connection before initializing schema...");
  const conn = await testConnection();
  if (!conn.connected) {
    console.error("Database connection failed:", conn.error);
    console.error("Please configure valid credentials in backend/.env first.");
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
  console.log("Reading schema from:", schemaPath);
  const sql = fs.readFileSync(schemaPath, "utf-8");

  try {
    console.log("Executing SQL schema...");
    await pool.query(sql);
    console.log("SUCCESS: All 10 database tables and seed data created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to execute schema:", err.message);
    process.exit(1);
  }
}

initDatabase();
