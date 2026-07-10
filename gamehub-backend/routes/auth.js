const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { verifyToken, verifyAdmin, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const SALT_ROUNDS = 10;

// ===================== TEST ROUTE =====================
router.get("/", (req, res) => {
    res.json({ message: "Auth Route Working" });
});

// ===================== REGISTER =====================
router.post("/register", async (req, res) => {
    const { first_name, last_name, email, password, phone, address } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters",
        });
    }

    try {
        // Never store plain-text passwords - hash before saving.
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const role = "customer";

        const sql = `
            INSERT INTO users
            (first_name, last_name, email, password, phone, address, role)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [first_name, last_name, email, hashedPassword, phone, address, role],
            (err, result) => {
                if (err) {
                    console.log(err);
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            success: false,
                            message: "An account with this email already exists",
                        });
                    }
                    return res.status(500).json({
                        success: false,
                        message: "Registration failed",
                    });
                }

                res.json({
                    success: true,
                    message: "User registered successfully",
                });
            }
        );
    } catch (err) {
        console.error("❌ Error hashing password:", err);
        res.status(500).json({ success: false, message: "Registration failed" });
    }
});

// ===================== LOGIN =====================
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.log("❌ Database error:", err);
            return res.status(500).json({
                success: false,
                message: "Database Error",
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email not found",
            });
        }

        const user = results[0];

        try {
            // Support accounts that still have an old plain-text password
            // (e.g. before this fix / not yet migrated) while still
            // requiring bcrypt for everything going forward.
            const storedPasswordLooksHashed = /^\$2[aby]\$/.test(user.password || "");

            const passwordMatches = storedPasswordLooksHashed
                ? await bcrypt.compare(password, user.password)
                : password === user.password;

            if (!passwordMatches) {
                return res.status(401).json({
                    success: false,
                    message: "Incorrect password",
                });
            }

            // Transparently upgrade legacy plain-text passwords to bcrypt
            // the next time that user logs in successfully.
            if (!storedPasswordLooksHashed) {
                const upgraded = await bcrypt.hash(password, SALT_ROUNDS);
                db.query("UPDATE users SET password = ? WHERE user_id = ?", [
                    upgraded,
                    user.user_id,
                ]);
            }

            const token = jwt.sign(
                { user_id: user.user_id, role: user.role, email: user.email },
                JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.json({
                success: true,
                message: "Login Successful",
                token,
                user: {
                    user_id: user.user_id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    phone: user.phone,
                    address: user.address,
                    role: user.role,
                },
            });
        } catch (compareErr) {
            console.error("❌ Error verifying password:", compareErr);
            res.status(500).json({ success: false, message: "Login failed" });
        }
    });
});

// ===================== GET ALL CUSTOMERS (ADMIN ONLY) =====================
router.get("/users", verifyToken, verifyAdmin, (req, res) => {
    const sql = `
        SELECT 
            user_id, 
            first_name, 
            last_name, 
            email, 
            phone, 
            address, 
            role,
            created_at
        FROM users 
        WHERE role = 'customer'
        ORDER BY user_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching users:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch users",
            });
        }

        res.json(results);
    });
});

module.exports = router;
