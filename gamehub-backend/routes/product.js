const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// Configure image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'upload/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

const upload = multer({ storage });

// =============================
// ADD PRODUCT
// =============================
router.post('/', verifyToken, verifyAdmin, upload.single('image'), (req, res) => {
    const { category_id, added_by, title, description, platform, price, stock, discount, featured } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = `
        INSERT INTO games
        (category_id, added_by, title, description, platform, price, stock, discount, image, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [category_id, added_by, title, description, platform, price, stock, discount, image, featured === 'true' ? 1 : 0],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.status(201).json({ success: true, message: 'Product added successfully', productId: result.insertId });
        }
    );
});

// =============================
// GET ALL PRODUCTS
// =============================
router.get('/', (req, res) => {
    const sql = `SELECT * FROM games ORDER BY game_id DESC`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json(results);
    });
});

// =============================
// GET SINGLE PRODUCT
// =============================
router.get('/:gameId', (req, res) => {
    const gameId = req.params.gameId;

    db.query('SELECT * FROM games WHERE game_id = ?', [gameId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json(results[0]);
    });
});

// =============================
// UPDATE PRODUCT
// =============================
router.put('/:gameId', verifyToken, verifyAdmin, upload.single('image'), (req, res) => {
    const gameId = req.params.gameId;
    const { category_id, title, description, platform, price, stock, discount, featured } = req.body;

    let sql = `
        UPDATE games
        SET category_id = ?, title = ?, description = ?, platform = ?, price = ?, stock = ?, discount = ?, featured = ?
    `;
    const values = [category_id, title, description, platform, price, stock, discount, featured === 'true' || featured === true ? 1 : 0];

    if (req.file) {
        sql += `, image = ?`;
        values.push(req.file.filename);
    }

    sql += ` WHERE game_id = ?`;
    values.push(gameId);

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Product updated successfully' });
    });
});

// =============================
// DELETE PRODUCT
// =============================
router.delete('/:gameId', verifyToken, verifyAdmin, (req, res) => {
    const gameId = req.params.gameId;

    db.query('DELETE FROM games WHERE game_id = ?', [gameId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, message: 'Product deleted successfully' });
    });
});

module.exports = router;