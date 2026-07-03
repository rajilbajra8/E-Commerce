const express = require("express");
const db = require("../config/db");

const router = express.Router();

// ===================== TEST ROUTE =====================
router.get("/", (req, res) => {
    res.json({
        message: "Auth Route Working"
    });
});

// ===================== REGISTER =====================
router.post("/register", (req, res) => {
    const {
        first_name,
        last_name,
        email,
        password,
        phone,
        address
    } = req.body;

    const role = "customer";

    const sql = `
        INSERT INTO users
        (first_name, last_name, email, password, phone, address, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [first_name, last_name, email, password, phone, address, role],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({
                    success: false,
                    message: "Registration failed"
                });
            }

            res.json({
                success: true,
                message: "User registered successfully"
            });
        }
    );
});

// ===================== LOGIN =====================
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Database Error"
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email not found"
            });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.status(401).json({
                success: false,
                message: "Incorrect password"
            });
        }

        res.json({
            success: true,
            message: "Login Successful",
            user: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });
    });
});

module.exports = router;