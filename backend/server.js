const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { testConnection } = require("./config/db");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");

// Route imports
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const guestRoutes = require("./routes/guestRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const checkInOutRoutes = require("./routes/checkInOutRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const staffRoutes = require("./routes/staffRoutes");

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Existing root test API (preserved)
app.get("/", (req, res) => {
  res.send("Hotel Management Backend Server is Running!");
});

// Mount API Modules
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/guests", guestRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/check-in-out", checkInOutRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/staff", staffRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Server Port
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(` Hotel Management Backend Server Started `);
  console.log(` Local URL : http://localhost:${PORT}`);
  console.log(` Health API: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);

  // Non-blocking database connectivity check
  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log(`[Database] PostgreSQL Connected successfully to: ${dbStatus.database}`);
  } else {
    console.warn(`[Database Notice] PostgreSQL not connected yet: ${dbStatus.error}`);
    console.warn(`[Database Notice] Please verify DB_PASSWORD in backend/.env to complete database connection.`);
  }
});

module.exports = app;
