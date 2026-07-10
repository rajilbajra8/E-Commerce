const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyAdmin } = require("../middleware/auth");

// =============================================
// HELPER: Attach Order Items
// =============================================
function attachOrderItems(orders, res) {
    if (!orders || orders.length === 0) {
        return res.json([]);
    }

    const orderIds = orders.map((order) => order.order_id);

    const itemSql = `
        SELECT
            oi.order_id,
            oi.quantity,
            oi.price,
            g.game_id,
            g.title,
            g.image
        FROM order_items oi
        JOIN games g ON oi.game_id = g.game_id
        WHERE oi.order_id IN (?)
    `;

    db.query(itemSql, [orderIds], (err, items) => {
        if (err) {
            console.error('Error fetching order items:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch order items' 
            });
        }

        const result = orders.map((order) => ({
            ...order,
            items: items.filter(
                (item) => item.order_id === order.order_id
            ),
        }));

        res.json(result);
    });
}

// =============================================
// HELPER: Clear User Cart
// =============================================
function clearUserCart(userId, callback) {
    const sql = `
        DELETE ci
        FROM cart_items ci
        JOIN cart c ON ci.cart_id = c.cart_id
        WHERE c.user_id = ?
    `;

    db.query(sql, [userId], callback);
}

// =============================================
// HELPER: Check Stock Before Order
// =============================================
function checkStock(items, callback) {
    if (!items || items.length === 0) {
        return callback(null, true);
    }

    const gameIds = items.map(item => item.game_id);
    const sql = `
        SELECT game_id, title, stock 
        FROM games 
        WHERE game_id IN (?)
    `;

    db.query(sql, [gameIds], (err, products) => {
        if (err) {
            return callback(err);
        }

        for (const item of items) {
            const product = products.find(p => p.game_id === item.game_id);
            if (!product) {
                return callback(null, false, `Product not found`);
            }
            if (product.stock < item.quantity) {
                return callback(null, false, `"${product.title}" - Only ${product.stock} available. You requested ${item.quantity}.`);
            }
        }

        callback(null, true);
    });
}

// =============================================
// HELPER: Update Stock After Order
// =============================================
function updateStock(items, callback) {
    if (!items || items.length === 0) {
        return callback(null);
    }

    let completed = 0;
    let hasError = false;

    for (const item of items) {
        const sql = `UPDATE games SET stock = stock - ? WHERE game_id = ? AND stock >= ?`;
        db.query(sql, [item.quantity, item.game_id, item.quantity], (err) => {
            if (err) {
                hasError = true;
            }
            completed++;
            if (completed === items.length) {
                callback(hasError ? new Error('Failed to update stock') : null);
            }
        });
    }
}

// =============================================
// HELPER: Restore Stock (order cancelled/deleted)
// =============================================
function restoreStock(items, callback) {
    if (!items || items.length === 0) {
        return callback(null);
    }

    let completed = 0;
    let hasError = false;

    for (const item of items) {
        const sql = `UPDATE games SET stock = stock + ? WHERE game_id = ?`;
        db.query(sql, [item.quantity, item.game_id], (err) => {
            if (err) hasError = true;
            completed++;
            if (completed === items.length) {
                callback(hasError ? new Error("Failed to restore stock") : null);
            }
        });
    }
}

// =============================================
// HELPER: Get items for an order
// =============================================
function getOrderItems(orderId, callback) {
    db.query(
        "SELECT game_id, quantity FROM order_items WHERE order_id = ?",
        [orderId],
        callback
    );
}

// =============================================
// GET ALL ORDERS (ADMIN)
// =============================================
router.get("/", verifyToken, verifyAdmin, (req, res) => {
    const sql = `
        SELECT
            o.order_id,
            o.user_id,
            o.total_amount,
            o.order_status,
            o.payment_status,
            o.shipping_name,
            o.shipping_email,
            o.shipping_phone,
            o.shipping_address,
            o.created_at,
            o.updated_at,
            u.first_name,
            u.last_name,
            u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        ORDER BY o.created_at DESC
    `;

    db.query(sql, (err, orders) => {
        if (err) {
            console.error('Error fetching orders:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch orders' 
            });
        }

        if (!orders || orders.length === 0) {
            return res.json([]);
        }

        const formattedOrders = orders.map(order => ({
            order_id: order.order_id,
            user_id: order.user_id,
            userName: order.shipping_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Guest',
            userEmail: order.shipping_email || order.email || 'No email',
            userPhone: order.shipping_phone || 'N/A',
            address: order.shipping_address || 'N/A',
            total: parseFloat(order.total_amount) || 0,
            status: order.order_status || 'Pending',
            paymentStatus: order.payment_status || 'Pending',
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            items: []
        }));

        if (formattedOrders.length > 0) {
            const orderIds = formattedOrders.map(o => o.order_id).join(',');
            
            const itemSql = `
                SELECT
                    oi.order_id,
                    oi.quantity,
                    oi.price,
                    g.game_id,
                    g.title,
                    g.image
                FROM order_items oi
                LEFT JOIN games g ON oi.game_id = g.game_id
                WHERE oi.order_id IN (${orderIds})
            `;

            db.query(itemSql, (err2, items) => {
                if (err2) {
                    console.error('Error fetching order items:', err2);
                    return res.json(formattedOrders);
                }

                if (items && items.length > 0) {
                    items.forEach(item => {
                        const order = formattedOrders.find(o => o.order_id === item.order_id);
                        if (order) {
                            order.items.push({
                                game_id: item.game_id,
                                title: item.title || 'Unknown Game',
                                quantity: item.quantity,
                                price: parseFloat(item.price) || 0,
                                image: item.image
                            });
                        }
                    });
                }

                res.json(formattedOrders);
            });
        } else {
            res.json(formattedOrders);
        }
    });
});

// =============================================
// GET USER ORDERS
// =============================================
router.get("/user/:userId", verifyToken, (req, res) => {
    const userId = req.params.userId;

    const sql = `
        SELECT
            o.order_id,
            o.user_id,
            o.total_amount,
            o.order_status,
            o.payment_status,
            o.shipping_name,
            o.shipping_email,
            o.shipping_phone,
            o.shipping_address,
            o.created_at,
            o.updated_at,
            u.first_name,
            u.last_name,
            u.email
        FROM orders o
        JOIN users u ON o.user_id = u.user_id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
    `;

    db.query(sql, [userId], (err, orders) => {
        if (err) {
            console.error('Error fetching user orders:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch orders' 
            });
        }

        const formattedOrders = orders.map(order => ({
            order_id: order.order_id,
            user_id: order.user_id,
            userName: order.shipping_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Guest',
            userEmail: order.shipping_email || order.email || 'No email',
            total: parseFloat(order.total_amount) || 0,
            status: order.order_status || 'Pending',
            paymentStatus: order.payment_status || 'Pending',
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            items: []
        }));

        attachOrderItems(formattedOrders, res);
    });
});

// =============================================
// GET SINGLE ORDER BY ID
// =============================================
router.get("/detail/:orderId", (req, res) => {
    const orderId = req.params.orderId;

    const sql = `
        SELECT
            o.order_id,
            o.user_id,
            o.total_amount,
            o.order_status,
            o.payment_status,
            o.shipping_name,
            o.shipping_email,
            o.shipping_phone,
            o.shipping_address,
            o.created_at,
            o.updated_at,
            u.first_name,
            u.last_name,
            u.email
        FROM orders o
        JOIN users u ON o.user_id = u.user_id
        WHERE o.order_id = ?
    `;

    db.query(sql, [orderId], (err, orders) => {
        if (err) {
            console.error('Error fetching order:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch order' 
            });
        }

        if (!orders || orders.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        const order = orders[0];
        const formattedOrder = {
            order_id: order.order_id,
            user_id: order.user_id,
            userName: order.shipping_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Guest',
            userEmail: order.shipping_email || order.email || 'No email',
            total: parseFloat(order.total_amount) || 0,
            status: order.order_status || 'Pending',
            paymentStatus: order.payment_status || 'Pending',
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            items: []
        };

        const itemsSql = `
            SELECT
                oi.order_item_id,
                oi.game_id,
                oi.quantity,
                oi.price,
                g.title,
                g.image
            FROM order_items oi
            JOIN games g ON oi.game_id = g.game_id
            WHERE oi.order_id = ?
        `;

        db.query(itemsSql, [orderId], (err2, items) => {
            if (err2) {
                console.error('Error fetching order items:', err2);
                return res.json(formattedOrder);
            }

            formattedOrder.items = items.map(item => ({
                order_item_id: item.order_item_id,
                game_id: item.game_id,
                title: item.title || 'Unknown Game',
                quantity: item.quantity,
                price: parseFloat(item.price) || 0,
                image: item.image
            }));

            res.json(formattedOrder);
        });
    });
});

// =============================================
// PLACE ORDER (POST) - WITH STOCK VALIDATION
// =============================================
router.post("/", (req, res) => {
    const { 
        user_id, 
        total_amount, 
        order_status, 
        payment_status,
        payment_method,
        shipping_name,
        shipping_email,
        shipping_phone,
        shipping_address,
        items 
    } = req.body;

    // Validation
    if (!user_id) {
        return res.status(400).json({ 
            success: false, 
            message: 'User ID is required' 
        });
    }

    if (!items || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'No items in order' 
        });
    }

    // =============================================
    // CHECK STOCK BEFORE CREATING ORDER
    // =============================================
    checkStock(items, (err, stockOk, stockError) => {
        if (err) {
            console.error('Stock check error:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to check stock availability' 
            });
        }

        if (!stockOk) {
            return res.status(400).json({ 
                success: false, 
                message: stockError || 'Insufficient stock for one or more items' 
            });
        }

        // =============================================
        // STOCK OK - PROCEED WITH ORDER
        // =============================================
        const orderSql = `
            INSERT INTO orders 
            (user_id, total_amount, order_status, payment_status, payment_method, shipping_name, shipping_email, shipping_phone, shipping_address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            orderSql,
            [user_id, total_amount, order_status || 'Pending', payment_status || 'Pending', payment_method || 'COD', shipping_name, shipping_email, shipping_phone, shipping_address],
            (err, result) => {
                if (err) {
                    console.error('Order creation error:', err);
                    // If the payment_method column hasn't been added yet,
                    // fall back so orders still work until the migration runs.
                    if (err.code === 'ER_BAD_FIELD_ERROR') {
                        return res.status(500).json({
                            success: false,
                            message: "Database is missing the 'payment_method' column. Run migration.sql, then try again.",
                            error: err.message
                        });
                    }
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Failed to create order',
                        error: err.message 
                    });
                }

                const orderId = result.insertId;

                // Insert order items
                const values = items.map(item => [
                    orderId,
                    item.game_id,
                    item.quantity,
                    item.price
                ]);

                db.query(
                    `INSERT INTO order_items (order_id, game_id, quantity, price) VALUES ?`,
                    [values],
                    (err2) => {
                        if (err2) {
                            console.error('Order items error:', err2);
                            db.query('DELETE FROM orders WHERE order_id = ?', [orderId]);
                            return res.status(500).json({ 
                                success: false, 
                                message: 'Failed to add order items',
                                error: err2.message 
                            });
                        }

                        // =============================================
                        // UPDATE STOCK AFTER ORDER
                        // =============================================
                        updateStock(items, (stockUpdateErr) => {
                            if (stockUpdateErr) {
                                console.error('Stock update error:', stockUpdateErr);
                                // Don't fail the order, just log the error
                            }

                            // Clear user's cart
                            db.query(
                                `DELETE ci FROM cart_items ci 
                                 JOIN cart c ON ci.cart_id = c.cart_id 
                                 WHERE c.user_id = ?`,
                                [user_id],
                                () => {
                                    res.json({
                                        success: true,
                                        message: 'Order placed successfully',
                                        order_id: orderId,
                                        total_amount,
                                        payment_method: payment_method || 'COD'
                                    });
                                }
                            );
                        });
                    }
                );
            }
        );
    });
});

// =============================================
// UPDATE ORDER STATUS
// =============================================
router.put("/:orderId/status", verifyToken, verifyAdmin, (req, res) => {
    const { orderId } = req.params;
    const { order_status } = req.body;

    const validStatuses = ['Pending', 'Processing', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(order_status)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid status. Must be: Pending, Processing, Completed, Cancelled' 
        });
    }

    // Look up the current status first so we know whether stock needs to
    // be restored (moving INTO Cancelled) or re-deducted (moving OUT of
    // Cancelled back into an active status).
    db.query(
        "SELECT order_status FROM orders WHERE order_id = ?",
        [orderId],
        (findErr, rows) => {
            if (findErr) {
                console.error('Error fetching order:', findErr);
                return res.status(500).json({ success: false, message: 'Failed to update order status' });
            }

            if (!rows || rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const previousStatus = rows[0].order_status;
            const enteringCancelled = order_status === 'Cancelled' && previousStatus !== 'Cancelled';
            const leavingCancelled = previousStatus === 'Cancelled' && order_status !== 'Cancelled';

            const applyStatusUpdate = () => {
                db.query(
                    "UPDATE orders SET order_status = ?, updated_at = NOW() WHERE order_id = ?",
                    [order_status, orderId],
                    (err, result) => {
                        if (err) {
                            console.error('Error updating order status:', err);
                            return res.status(500).json({
                                success: false,
                                message: 'Failed to update order status'
                            });
                        }

                        if (result.affectedRows === 0) {
                            return res.status(404).json({
                                success: false,
                                message: 'Order not found'
                            });
                        }

                        res.json({
                            success: true,
                            message: 'Order status updated successfully',
                            order_id: orderId,
                            order_status: order_status
                        });
                    }
                );
            };

            if (enteringCancelled) {
                // Give the stock back to the store.
                getOrderItems(orderId, (itemsErr, items) => {
                    if (itemsErr) {
                        console.error('Error fetching order items:', itemsErr);
                        return res.status(500).json({ success: false, message: 'Failed to update order status' });
                    }
                    restoreStock(items, (restoreErr) => {
                        if (restoreErr) console.error('Stock restore error:', restoreErr);
                        applyStatusUpdate();
                    });
                });
            } else if (leavingCancelled) {
                // Re-activating a cancelled order - make sure stock is
                // still available before taking it out of the pool again.
                getOrderItems(orderId, (itemsErr, items) => {
                    if (itemsErr) {
                        console.error('Error fetching order items:', itemsErr);
                        return res.status(500).json({ success: false, message: 'Failed to update order status' });
                    }
                    checkStock(items, (stockErr, stockOk, stockError) => {
                        if (stockErr) {
                            console.error('Stock check error:', stockErr);
                            return res.status(500).json({ success: false, message: 'Failed to update order status' });
                        }
                        if (!stockOk) {
                            return res.status(400).json({
                                success: false,
                                message: stockError || 'Cannot reactivate order - insufficient stock'
                            });
                        }
                        updateStock(items, (updateErr) => {
                            if (updateErr) console.error('Stock update error:', updateErr);
                            applyStatusUpdate();
                        });
                    });
                });
            } else {
                applyStatusUpdate();
            }
        }
    );
});

// =============================================
// UPDATE PAYMENT STATUS
// =============================================
router.put("/:orderId/payment", verifyToken, verifyAdmin, (req, res) => {
    const { orderId } = req.params;
    const { payment_status } = req.body;

    const validStatuses = ['Pending', 'Paid', 'Failed', 'Refunded'];
    if (!validStatuses.includes(payment_status)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid payment status. Must be: Pending, Paid, Failed, Refunded' 
        });
    }

    db.query(
        "UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE order_id = ?",
        [payment_status, orderId],
        (err, result) => {
            if (err) {
                console.error('Error updating payment status:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to update payment status' 
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Order not found' 
                });
            }

            res.json({
                success: true,
                message: 'Payment status updated successfully',
                order_id: orderId,
                payment_status: payment_status
            });
        }
    );
});

// =============================================
// DELETE ORDER (Admin Only)
// =============================================
router.delete("/:orderId", verifyToken, verifyAdmin, (req, res) => {
    const { orderId } = req.params;

    // If the order was never cancelled, its stock is still "checked out" -
    // give it back before the order (and its items) disappear forever.
    db.query(
        "SELECT order_status FROM orders WHERE order_id = ?",
        [orderId],
        (findErr, rows) => {
            if (findErr) {
                console.error('Error fetching order:', findErr);
                return res.status(500).json({ success: false, message: 'Failed to delete order' });
            }
            if (!rows || rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const wasCancelled = rows[0].order_status === 'Cancelled';

            const proceedWithDelete = () => {
                db.query(
                    "DELETE FROM orders WHERE order_id = ?",
                    [orderId],
                    (err, result) => {
                        if (err) {
                            console.error('Error deleting order:', err);
                            return res.status(500).json({ 
                                success: false, 
                                message: 'Failed to delete order' 
                            });
                        }

                        if (result.affectedRows === 0) {
                            return res.status(404).json({ 
                                success: false, 
                                message: 'Order not found' 
                            });
                        }

                        res.json({
                            success: true,
                            message: 'Order deleted successfully'
                        });
                    }
                );
            };

            if (wasCancelled) {
                proceedWithDelete();
            } else {
                getOrderItems(orderId, (itemsErr, items) => {
                    if (itemsErr) {
                        console.error('Error fetching order items:', itemsErr);
                        return res.status(500).json({ success: false, message: 'Failed to delete order' });
                    }
                    restoreStock(items, (restoreErr) => {
                        if (restoreErr) console.error('Stock restore error:', restoreErr);
                        proceedWithDelete();
                    });
                });
            }
        }
    );
});

module.exports = router;