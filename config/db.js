import mysql2 from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple connection pool for Aiven
const pool = mysql2.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: 25580,
  ssl: {
    rejectUnauthorized: false  // Bypass SSL certificate issues
  },
  connectionLimit: 2,          // Keep very low for Aiven free tier
  acquireTimeout: 60000,       // 60 seconds to get connection
});

// Test connection function
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

// Query function with retry logic
async function executeQuery(query, params = []) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [results] = await pool.execute(query, params);
      return results;
    } catch (error) {
      lastError = error;
      console.error(`Query attempt ${attempt} failed:`, error.message);
      
      // Wait before retry for connection errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        if (attempt < maxRetries) {
          console.log(`Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Test connection on startup
testConnection();

export { pool, executeQuery };
export default pool;