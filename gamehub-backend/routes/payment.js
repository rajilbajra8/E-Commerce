const express = require("express");
const router = express.Router();
const db = require("../config/db");




const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || null;
const KHALTI_BASE_URL =
    process.env.KHALTI_BASE_URL || "https://a.khalti.com/api/v2"; // sandbox: https://a.khalti.com/api/v2 (test), swap for live URL in prod

// =============================================
// INITIATE PAYMENT
// =============================================
router.post("/khalti/initiate", async (req, res) => {
    const { order_id, amount, return_url, website_url } = req.body;

    if (!order_id || !amount) {
        return res.status(400).json({
            success: false,
            message: "order_id and amount are required",
        });
    }

    if (!KHALTI_SECRET_KEY) {
        // No key configured yet - tell the caller plainly instead of
        // pretending it worked, so the UI can show "coming soon".
        return res.status(503).json({
            success: false,
            message:
                "Khalti is not configured yet. Add KHALTI_SECRET_KEY to the backend .env to enable it.",
        });
    }

    try {
        // TODO: once KHALTI_SECRET_KEY is set, uncomment this real call.
        //
        // const response = await fetch(`${KHALTI_BASE_URL}/epayment/initiate/`, {
        //     method: "POST",
        //     headers: {
        //         Authorization: `Key ${KHALTI_SECRET_KEY}`,
        //         "Content-Type": "application/json",
        //     },
        //     body: JSON.stringify({
        //         return_url,           // e.g. http://localhost:5173/checkout/khalti-return
        //         website_url,          // e.g. http://localhost:5173
        //         amount: Math.round(amount * 100), // Khalti expects paisa
        //         purchase_order_id: String(order_id),
        //         purchase_order_name: `GameHub Order #${order_id}`,
        //     }),
        // });
        // const data = await response.json();
        //
        // if (!response.ok) {
        //     return res.status(502).json({ success: false, message: "Khalti initiation failed", error: data });
        // }
        //
        // // Save the pidx against the order so we can verify it later.
        // db.query(
        //     "UPDATE orders SET payment_reference = ? WHERE order_id = ?",
        //     [data.pidx, order_id]
        // );
        //
        // return res.json({ success: true, pidx: data.pidx, payment_url: data.payment_url });

        return res.status(501).json({
            success: false,
            message: "Khalti key is set but the API call is still commented out in routes/payment.js - see the TODO.",
        });
    } catch (err) {
        console.error("Khalti initiate error:", err);
        res.status(500).json({ success: false, message: "Failed to initiate Khalti payment" });
    }
});

// =============================================
// VERIFY PAYMENT (called after Khalti redirects back)
// =============================================
router.post("/khalti/verify", async (req, res) => {
    const { pidx, order_id } = req.body;

    if (!pidx || !order_id) {
        return res.status(400).json({
            success: false,
            message: "pidx and order_id are required",
        });
    }

    if (!KHALTI_SECRET_KEY) {
        return res.status(503).json({
            success: false,
            message: "Khalti is not configured yet.",
        });
    }

    try {
        // TODO: once KHALTI_SECRET_KEY is set, uncomment this real call.
        //
        // const response = await fetch(`${KHALTI_BASE_URL}/epayment/lookup/`, {
        //     method: "POST",
        //     headers: {
        //         Authorization: `Key ${KHALTI_SECRET_KEY}`,
        //         "Content-Type": "application/json",
        //     },
        //     body: JSON.stringify({ pidx }),
        // });
        // const data = await response.json();
        //
        // if (data.status === "Completed") {
        //     db.query(
        //         "UPDATE orders SET payment_status = 'Paid' WHERE order_id = ?",
        //         [order_id]
        //     );
        //     return res.json({ success: true, status: data.status });
        // }
        //
        // return res.status(400).json({ success: false, status: data.status, message: "Payment not completed" });

        return res.status(501).json({
            success: false,
            message: "Khalti key is set but the API call is still commented out in routes/payment.js - see the TODO.",
        });
    } catch (err) {
        console.error("Khalti verify error:", err);
        res.status(500).json({ success: false, message: "Failed to verify Khalti payment" });
    }
});

module.exports = router;
