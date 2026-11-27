const crypto = require("crypto");
const { pool, testConnection } = require("../config/db");
const { hashPassword } = require("../utils/password");

// Parse command-line flags if provided, e.g. --email=admin@test.com --password=secret
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, ...values] = arg.slice(2).split("=");
      args[key] = values.join("=");
    }
  });
  return args;
}

async function seedAdmin() {
  console.log("==================================================");
  console.log(" Hotel Management System - Admin Setup Utility ");
  console.log("==================================================");

  // 1. Check database connectivity
  const conn = await testConnection();
  if (!conn.connected) {
    console.error("Database connection failed:", conn.error);
    console.error("Please ensure PostgreSQL is running and backend/.env has valid credentials.");
    process.exit(1);
  }

  // 2. Check if an admin already exists (Prevent duplicate/overwriting)
  const existingAdminRes = await pool.query(
    "SELECT id, full_name, email, role, created_at FROM users WHERE role = 'admin' LIMIT 1;"
  );

  if (existingAdminRes.rows.length > 0) {
    const admin = existingAdminRes.rows[0];
    console.log(`NOTICE: An admin user already exists in the database.`);
    console.log(`- Email: ${admin.email}`);
    console.log(`- Name : ${admin.full_name}`);
    console.log(`- Since: ${admin.created_at}`);
    console.log(`Existing admin will NOT be overwritten.`);
    console.log("==================================================");
    process.exit(0);
  }

  // 3. Determine admin details safely (CLI args > Environment Variables > Secure Random)
  const cliArgs = parseArgs();
  const email = (cliArgs.email || process.env.ADMIN_EMAIL || "admin@hotel.com").toLowerCase().trim();
  const fullName = cliArgs.name || process.env.ADMIN_NAME || "System Administrator";
  const phone = cliArgs.phone || process.env.ADMIN_PHONE || "9999999999";

  let password = cliArgs.password || process.env.ADMIN_PASSWORD;
  let isGenerated = false;

  if (!password) {
    // Generate secure 12-char random alphanumeric password if none provided
    password = crypto.randomBytes(6).toString("hex") + "!A1";
    isGenerated = true;
  }

  // 4. Check if the specified email is already in use
  const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (emailCheck.rows.length > 0) {
    console.error(`ERROR: A user with email '${email}' already exists with another role.`);
    console.error("Please choose a different ADMIN_EMAIL or promote the existing user.");
    process.exit(1);
  }

  // 5. Hash password with bcrypt
  const passwordHash = await hashPassword(password);

  // 6. Insert admin into PostgreSQL
  const insertRes = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, phone, status)
     VALUES ($1, $2, $3, 'admin', $4, 'active')
     RETURNING id, full_name, email, role, status, created_at`,
    [fullName, email, passwordHash, phone]
  );

  const newAdmin = insertRes.rows[0];
  console.log("SUCCESS: Initial Admin user created successfully!");
  console.log(`- Admin ID: ${newAdmin.id}`);
  console.log(`- Name    : ${newAdmin.full_name}`);
  console.log(`- Email   : ${newAdmin.email}`);
  console.log(`- Role    : ${newAdmin.role}`);
  console.log(`- Status  : ${newAdmin.status}`);

  if (isGenerated) {
    console.log("\n==================================================");
    console.log("IMPORTANT: AUTO-GENERATED TEMPORARY PASSWORD:");
    console.log(`Password: ${password}`);
    console.log("Please save this password securely and change it upon first login.");
    console.log("==================================================");
  } else {
    console.log("- Password: [Configured from environment/arguments]");
  }

  console.log("==================================================");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Unexpected error during admin seeding:", err.message);
  process.exit(1);
});
