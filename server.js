import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import db from "./config/db.js";
import { generateJwtSecret } from "./generateJwtSecret.js";
import passport from './routes/passportConfig.js';
import session from 'express-session';
import LoginRoute from './routes/loginRoute.js';
import RegisterRoute from './routes/registerRoute.js';
import GuestsRoute from './routes/guests.js';
import ContactRoute from './routes/contactRoute.js';
import ReferenceRoute from './routes/referenceRoutes.js';
import GetReferenceRoute from './routes/getReferenceRoute.js';
import UkCitiesRouter from './routes/ukCities.js';
import apiChatRoute from './routes/apiChatRoute.js';
import projectActionsRoute from './routes/projectActionsRoute.js';
import weatherRoutes from './routes/weatherRoutes.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000", "https://shivashankerportfolio.netlify.app"],
    credentials: true 
}));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
    res.send("Server is up and running!");
});

app.get("/db-status", (req, res) => {
    db.query('SELECT 1 + 1 AS solution', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database query failed" });
        }
        res.json({ solution: results[0].solution });
    });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }), 
    (req, res) => {
        res.redirect('/profile');
    }
);

app.get('/profile', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json({ message: `Welcome, ${req.user.name}` });
});

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    });
});

app.use('/api/chat', apiChatRoute);
app.use('/api/login', LoginRoute);
app.use('/api/register', RegisterRoute);
app.use('/api/guests', GuestsRoute);
app.use('/api/contact', ContactRoute);
app.use('/api/references', ReferenceRoute);
app.use('/api/references/get', GetReferenceRoute);
app.use('/api', UkCitiesRouter);
app.use('/api/projects', projectActionsRoute);
app.use('/api/weather', weatherRoutes);

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
