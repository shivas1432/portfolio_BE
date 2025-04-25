import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import db from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.query('SELECT * FROM resumeusers WHERE id = ?', [id], (err, results) => {
        done(err, results[0]);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:8081/auth/google/callback",
    passReqToCallback: true
},
  (accessToken, refreshToken, profile, done) => {
    const googleId = profile.id;
    const name = profile.displayName;
    const email = profile.emails[0].value;

    db.query('SELECT * FROM resumeusers WHERE google_id = ?', [googleId], (err, results) => {
        if (err) return done(err);

        if (results.length > 0) {
            return done(null, results[0]);
        } else {
            db.query('INSERT INTO resumeusers (name, email, google_id) VALUES (?, ?, ?)', [name, email, googleId], (err, result) => {
                if (err) return done(err);
                db.query('SELECT * FROM resumeusers WHERE google_id = ?', [googleId], (err, results) => {
                    if (err) return done(err);
                    return done(null, results[0]);
                });
            });
        }
    });
  }
));

export default passport;
