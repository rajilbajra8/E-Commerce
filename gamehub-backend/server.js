require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

// Connect Database
require("./config/db");

// Import Routes
const authRoutes = require("./routes/auth");
const productsRoute = require("./routes/product");

// NEW ROUTES
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/order");
const paymentRoutes = require("./routes/payment");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use(
    "/upload",
    express.static(path.join(__dirname, "upload"))
);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoute);

// NEW API ROUTES
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);

// Home Route
app.get("/", (req, res) => {
    res.send("GameHub Backend is Running");
});

// Test Route
app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "GameHub API Working",
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});