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

router.post('/', upload.single('image'), async (req, res) => {
  const { name, email, jobTitle, company, relationship } = req.body;
  const imagePath = req.file ? req.file.path : null;

  try {
    await db.execute(
      'INSERT INTO reference (name, email, job_title, company, relationship, image_path) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, jobTitle, company, relationship, imagePath]
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

export default router;
