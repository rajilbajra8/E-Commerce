const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/db');

// Configure image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'upload/');
    },

    filename: (req, file, cb) => {
        cb(
            null,
            Date.now() + '-' + file.originalname
        );
    },
});

const upload = multer({
    storage,
});

// =============================
// ADD PRODUCT
// =============================
router.post(
    '/',
    upload.single('image'),
    async (req, res) => {
        try {
            const {
    category_id,
    added_by,
    title,
    description,
    platform,
    price,
    stock,
    discount,
    featured,
} = req.body;

            const image = req.file
                ? req.file.filename
                : null;

            const sql = `
                INSERT INTO games
(
    category_id,
    added_by,
    title,
    description,
    platform,
    price,
    stock,
    discount,
    image,
    featured
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                sql,
                [
    category_id,
    added_by,
    title,
    description,
    platform,
    price,
    stock,
    discount,
    image,
    featured === 'true' ? 1 : 0,
],
                (err, result) => {
                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: 'Database error',
                        });
                    }

                    res.status(201).json({
                        success: true,
                        message: 'Product added successfully',
                        productId: result.insertId,
                    });
                }
            );
        } catch (err) {
            console.error(err);

            res.status(500).json({
                success: false,
                message: 'Server error',
            });
        }
    }
);

// =============================
// GET ALL PRODUCTS
// =============================
router.get('/', (req, res) => {
    const sql = `
        SELECT *
        FROM games
        ORDER BY game_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: 'Database error',
            });
        }

        res.json(results);
    });
});

module.exports = router;