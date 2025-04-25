import express from 'express';
import nodemailer from 'nodemailer';
import db from '../config/db.js';

const router = express.Router();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

router.post('/', (req, res) => {
    const { name, email, message } = req.body;

    const mailOptions = {
        from: email,
        to: process.env.EMAIL,
        subject: `Contact Form Submission from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).send({ message: 'Error sending email' });
        }
        console.log('Email sent:', info.response);

        const query = 'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)';
        db.query(query, [name, email, message], (err, result) => {
            if (err) {
                console.error('Error saving message to database:', err);
                return res.status(500).send({ message: 'Message sent, but error saving to database' });
            }

            res.status(200).send({ message: 'Message sent successfully' });
        });
    });
});

export default router;
