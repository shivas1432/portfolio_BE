import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import db from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'lor', maxCount: 1 }
]), async (req, res) => {
  const { name, email, jobTitle, company, relationship, aboutMe } = req.body;
  const imagePath = req.files.image ? `uploads/${req.files.image[0].filename}` : null;
  const signaturePath = req.files.signature ? `uploads/${req.files.signature[0].filename}` : null;
  const lorPath = req.files.lor ? `uploads/${req.files.lor[0].filename}` : null;

  try {
    await db.execute(
      `INSERT INTO reference 
       (name, email, job_title, company, relationship, about_me, image_path, signature_path, lor_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, jobTitle, company, relationship, aboutMe, imagePath, signaturePath, lorPath]
    );

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Reference Submission Confirmation',
      text: `Thank you, ${name}, for submitting your reference. Your reference has been recorded successfully!`,
    });

    res.status(200).json({ message: 'Reference submitted successfully!' });
  } catch (error) {
    console.error('Error saving reference:', error);
    res.status(500).json({ message: 'Failed to submit reference. Please try again later.' });
  }
});

router.get('/', (req, res) => {
  const query = 'SELECT * FROM reference';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching references:', err);
      return res.status(500).json({ error: 'Failed to fetch references' });
    }
    res.json(results);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM reference WHERE id = ?';

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching reference:', err);
      return res.status(500).json({ error: 'Failed to fetch reference' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    res.json(results[0]);
  });
});

router.put('/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'lor', maxCount: 1 }
]), async (req, res) => {
  const { id } = req.params;
  const { name, email, jobTitle, company, relationship, aboutMe } = req.body;

  try {
    const [current] = await db.execute('SELECT * FROM reference WHERE id = ?', [id]);

    if (current.length === 0) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    const imagePath = req.files.image ? `uploads/${req.files.image[0].filename}` : current[0].image_path;
    const signaturePath = req.files.signature ? `uploads/${req.files.signature[0].filename}` : current[0].signature_path;
    const lorPath = req.files.lor ? `uploads/${req.files.lor[0].filename}` : current[0].lor_path;

    const query = `
      UPDATE reference 
      SET name = ?, email = ?, job_title = ?, company = ?, relationship = ?, about_me = ?, image_path = ?, signature_path = ?, lor_path = ?
      WHERE id = ?
    `;

    await db.execute(query, [name, email, jobTitle, company, relationship, aboutMe, imagePath, signaturePath, lorPath, id]);
    res.json({ message: 'Reference updated successfully!' });
  } catch (error) {
    console.error('Error updating reference:', error);
    res.status(500).json({ error: 'Failed to update reference' });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM reference WHERE id = ?';

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error deleting reference:', err);
      return res.status(500).json({ error: 'Failed to delete reference' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    res.json({ message: 'Reference deleted successfully!' });
  });
});

export default router;
