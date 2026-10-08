const mongoose = require('mongoose');
const dns = require('dns');

// On Windows, Node's default DNS resolver often returns querySrv ECONNREFUSED for MongoDB Atlas SRV records.
// Setting public DNS resolvers (Google DNS) ensures reliable Atlas SRV lookups.
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {
  // If setServers is not supported in the environment, continue with system defaults
}

/**
 * Connect to MongoDB using Mongoose
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('[Database Error] MONGODB_URI is not defined in environment variables.');
    console.error('Please set MONGODB_URI in your server/.env file.');
    process.exit(1);
  }

  // Setup connection lifecycle event listeners
  mongoose.connection.on('connected', () => {
    console.log(`[Database] Mongoose connected to host: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[Database Error] Runtime connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database Warning] Mongoose disconnected from MongoDB.');
  });

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds if database is not reachable
    });

    console.log(`[Database] Connected successfully to database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Initial connection failed: ${error.message}`);
    console.error('[Database Tip] Ensure your MongoDB service or Atlas cluster is accessible and your MONGODB_URI is correct.');
    process.exit(1);
  }
};

module.exports = connectDB;
