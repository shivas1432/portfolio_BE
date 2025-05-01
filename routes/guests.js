import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/db.js';

const router = express.Router();

router.post('/', [
  body('name')
    .notEmpty().withMessage('Name is required')
    .matches(/^[A-Za-z\s]+$/).withMessage('Name must contain only letters and spaces.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name } = req.body;

  try {
    const query = 'INSERT INTO guests (name) VALUES (?)';
    db.query(query, [name], (err, result) => {
      if (err) {
        console.error('Error saving guest name:', err);
        return res.status(500).json({ message: 'Error saving guest name.', error: err.message });
      }
      res.status(201).json({ message: 'Guest name saved successfully!' });
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
