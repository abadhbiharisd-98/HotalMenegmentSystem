const express = require("express");
const router = express.Router();
const { testConnection } = require("../config/db");

// GET /api/health
router.get("/", async (req, res) => {
  const dbStatus = await testConnection();

  const healthData = {
    status: dbStatus.connected ? "healthy" : "degraded",
    server: {
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
    },
    database: {
      type: "PostgreSQL",
      connected: dbStatus.connected,
      ...(dbStatus.connected
        ? {
            databaseName: dbStatus.database,
            connectedUser: dbStatus.user,
            serverTime: dbStatus.time,
          }
        : {
            error: dbStatus.error,
            help: "Please configure DB_PASSWORD and PostgreSQL credentials in backend/.env",
          }),
    },
  };

  const statusCode = dbStatus.connected ? 200 : 503;
  return res.status(statusCode).json({
    success: dbStatus.connected,
    ...healthData,
  });
});

module.exports = router;
