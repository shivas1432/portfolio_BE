import mysql2 from 'mysql2';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

let db;
let isConnecting = false;

// Connection configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: 25580,
  ssl: {
    ca: fs.readFileSync('./ca-cert.pem'),
    rejectUnauthorized: false
  },
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

function createConnection() {
  if (isConnecting) {
    console.log('Connection already in progress...');
    return;
  }
  
  isConnecting = true;
  console.log('Creating new database connection...');
  
  db = mysql2.createConnection(dbConfig);

  // Handle connection errors and auto-reconnect
  db.on('error', (err) => {
    console.error('Database connection error:', err.message);
    isConnecting = false;
    
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || 
        err.code === 'ECONNRESET' || 
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED') {
      console.log('Connection lost, attempting to reconnect in 5 seconds...');
      setTimeout(createConnection, 5000);
    }
  });

  db.on('end', () => {
    console.log('Database connection ended');
    isConnecting = false;
  });

  // Connect to the database
  db.connect((err) => {
    isConnecting = false;
    
    if (err) {
      console.error('Database connection failed:', err.message);
      console.log('Retrying connection in 5 seconds...');
      setTimeout(createConnection, 5000);
    } else {
      console.log('Connected to the database successfully.');
    }
  });
}

// Enhanced query function with timeout, retry, and reconnection
function queryWithTimeout(sql, params = [], timeout = 15000) {
  return new Promise((resolve, reject) => {
    // Check if connection exists
    if (!db) {
      console.log('No database connection, creating new one...');
      createConnection();
      return reject(new Error('Database not connected, please retry'));
    }

    let timeoutId;
    let queryExecuted = false;

    // Set timeout
    timeoutId = setTimeout(() => {
      if (!queryExecuted) {
        queryExecuted = true;
        console.error('Query timeout after', timeout, 'ms');
        reject(new Error('Query timeout - database may be slow or disconnected'));
      }
    }, timeout);

    // Execute query
    db.query(sql, params, (err, results) => {
      if (queryExecuted) return; // Timeout already occurred
      
      queryExecuted = true;
      clearTimeout(timeoutId);
      
      if (err) {
        console.error('Query error:', err.message);
        
        // Handle connection errors by reconnecting
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || 
            err.code === 'ECONNRESET' || 
            err.code === 'ETIMEDOUT' ||
            err.code === 'ECONNREFUSED') {
          console.log('Connection lost during query, reconnecting...');
          createConnection();
          reject(new Error('Connection lost, please retry'));
        } else {
          reject(err);
        }
      } else {
        resolve(results);
      }
    });
  });
}

// Enhanced query with automatic retry
async function queryWithRetry(sql, params = [], maxRetries = 3, timeout = 15000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Query attempt ${attempt}/${maxRetries}`);
      const results = await queryWithTimeout(sql, params, timeout);
      return results;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Query failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = attempt * 2000; // 2s, 4s, 6s
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Health check function
async function healthCheck() {
  try {
    await queryWithTimeout('SELECT 1 as test', [], 5000);
    return { status: 'healthy', message: 'Database connected' };
  } catch (error) {
    return { status: 'unhealthy', message: error.message };
  }
}

// Create initial connection
createConnection();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down database connection...');
  if (db) {
    db.end(() => {
      console.log('Database connection closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Keep connection alive with periodic health checks
setInterval(async () => {
  try {
    await queryWithTimeout('SELECT 1', [], 5000);
  } catch (error) {
    console.log('Health check failed, connection may be lost');
  }
}, 30000); // Every 30 seconds

export { db, queryWithTimeout, queryWithRetry, healthCheck };
export default db;