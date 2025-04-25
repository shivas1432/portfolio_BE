import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.post('/:id/like', (req, res) => {
    const projectId = req.params.id;

    const query = `
        INSERT INTO resumeusers (id, like_count)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE like_count = like_count + 1
    `;

    db.query(query, [projectId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', err });

        res.json({ message: 'Project liked successfully' });
    });
});

router.post('/:id/comment', (req, res) => {
    const projectId = req.params.id;
    const { comment } = req.body;

    if (!comment) {
        return res.status(400).json({ message: 'Comment cannot be empty' });
    }

    const query = `
        INSERT INTO resumeusers (id, comments)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE comments = CONCAT(comments, '\n', ?)
    `;

    db.query(query, [projectId, comment, comment], (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', err });

        res.json({ message: 'Comment added successfully' });
    });
});

export default router;
