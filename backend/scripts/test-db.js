const { testConnection } = require("../config/db");

async function runTest() {
  console.log("==========================================");
  console.log("Testing PostgreSQL Database Connection...");
  console.log("Host:", process.env.DB_HOST || "localhost");
  console.log("Port:", process.env.DB_PORT || 5432);
  console.log("Database:", process.env.DB_NAME || "hotel_management");
  console.log("User:", process.env.DB_USER || "postgres");
  console.log("==========================================");

  const result = await testConnection();

  if (result.connected) {
    console.log("STATUS: SUCCESS!");
    console.log("Connected to PostgreSQL successfully.");
    console.log("Database:", result.database);
    console.log("Connected User:", result.user);
    console.log("Server Time:", result.time);
    process.exit(0);
  } else {
    console.error("STATUS: FAILED TO CONNECT");
    console.error("Error Details:", result.error);
    console.log("\nTROUBLESHOOTING TIP:");
    console.log("1. Check if PostgreSQL server is running (Service: postgresql-x64-18).");
    console.log("2. Open backend/.env and verify DB_USER, DB_PASSWORD, DB_PORT, and DB_NAME.");
    console.log("3. If password was set during PostgreSQL installation, enter it in backend/.env.");
    process.exit(1);
  }
}

runTest();
