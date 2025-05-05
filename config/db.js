import mysql2 from 'mysql2';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

const db = mysql2.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: 25580,
  ssl: {
    ca: fs.readFileSync('./ca-cert.pem'),  // Path to the Aiven CA certificate
    rejectUnauthorized: false  // Ignore certificate errors (not recommended for production)
  }
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to the database.');
  }
});

export default db;
