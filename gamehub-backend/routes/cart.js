const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ===============================
// GET USER CART
// ===============================
router.get("/:userId", (req, res) => {
    const userId = req.params.userId;

    const sql = `
        SELECT
            ci.cart_item_id,
            ci.quantity,
            g.game_id,
            g.title,
            g.price,
            g.image,
            g.platform,
            g.discount,
            g.stock
        FROM cart c
        JOIN cart_items ci ON c.cart_id = ci.cart_id
        JOIN games g ON ci.game_id = g.game_id
        WHERE c.user_id = ?
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to load cart",
            });
        }
        res.json(results);
    });
});

// ===============================
// ADD TO CART
// ===============================
router.post("/", (req, res) => {
    const { user_id, game_id, quantity } = req.body;
    const requestedQty = Number(quantity) || 1;

    // -------------------------------------------------
    // STOCK CHECK - never let anyone add more of a game
    // to their cart than is actually in stock.
    // -------------------------------------------------
    db.query("SELECT stock, title FROM games WHERE game_id = ?", [game_id], (stockErr, gameRows) => {
        if (stockErr) return res.status(500).json({ success: false, message: "Failed to check stock" });

        if (!gameRows || gameRows.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const { stock, title } = gameRows[0];

        if (stock <= 0) {
            return res.status(400).json({ success: false, message: `"${title}" is out of stock.` });
        }

        const cartSql = "SELECT * FROM cart WHERE user_id=?";

        db.query(cartSql, [user_id], (err, cartResult) => {
            if (err) return res.status(500).json({ success: false, message: "Failed to add to cart" });

            if (cartResult.length === 0) {
                db.query("INSERT INTO cart(user_id) VALUES(?)", [user_id], (err, result) => {
                    if (err) return res.status(500).json({ success: false, message: "Failed to add to cart" });
                    insertItem(result.insertId);
                });
            } else {
                insertItem(cartResult[0].cart_id);
            }
        });

        function insertItem(cartId) {
            const checkSql = `SELECT * FROM cart_items WHERE cart_id=? AND game_id=?`;

            db.query(checkSql, [cartId, game_id], (err, rows) => {
                if (err) return res.status(500).json({ success: false, message: "Failed to add to cart" });

                const existingQty = rows.length > 0 ? rows[0].quantity : 0;
                const newTotalQty = existingQty + requestedQty;

                if (newTotalQty > stock) {
                    return res.status(400).json({
                        success: false,
                        message: `Only ${stock} of "${title}" available. You already have ${existingQty} in your cart.`,
                    });
                }

                if (rows.length > 0) {
                    db.query(
                        `UPDATE cart_items SET quantity = ? WHERE cart_id=? AND game_id=?`,
                        [newTotalQty, cartId, game_id],
                        (err) => {
                            if (err) return res.status(500).json({ success: false, message: "Failed to add to cart" });
                            res.json({ success: true, message: "Cart updated" });
                        }
                    );
                } else {
                    db.query(
                        `INSERT INTO cart_items (cart_id, game_id, quantity) VALUES(?,?,?)`,
                        [cartId, game_id, newTotalQty],
                        (err) => {
                            if (err) return res.status(500).json({ success: false, message: "Failed to add to cart" });
                            res.json({ success: true, message: "Added to cart" });
                        }
                    );
                }
            });
        }
    });
});

// ===============================
// UPDATE QUANTITY
// ===============================
router.put("/:cartItemId", (req, res) => {
    const { quantity } = req.body;
    const requestedQty = Number(quantity);

    if (!requestedQty || requestedQty < 1) {
        return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    // Look up the game behind this cart item so we can enforce its stock.
    const stockSql = `
        SELECT g.stock, g.title
        FROM cart_items ci
        JOIN games g ON ci.game_id = g.game_id
        WHERE ci.cart_item_id = ?
    `;

    db.query(stockSql, [req.params.cartItemId], (stockErr, rows) => {
        if (stockErr) return res.status(500).json({ success: false, message: "Failed to update quantity" });

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: "Cart item not found" });
        }

        const { stock, title } = rows[0];

        if (requestedQty > stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${stock} of "${title}" available.`,
            });
        }

        db.query(
            "UPDATE cart_items SET quantity=? WHERE cart_item_id=?",
            [requestedQty, req.params.cartItemId],
            (err) => {
                if (err) return res.status(500).json({ success: false, message: "Failed to update quantity" });
                res.json({ success: true, message: "Quantity updated" });
            }
        );
    });
});

// ===============================
// DELETE ITEM
// ===============================
router.delete("/:cartItemId", (req, res) => {
    db.query(
        "DELETE FROM cart_items WHERE cart_item_id=?",
        [req.params.cartItemId],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: "Failed to remove item" });
            res.json({ success: true, message: "Item removed" });
        }
    );
});

module.exports = router;
