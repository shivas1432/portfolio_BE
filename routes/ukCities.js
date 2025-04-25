import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.get('/uk-cities', (req, res) => {
    const sql = 'SELECT * FROM uk_cities';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(results);
    });
});

export default router;
