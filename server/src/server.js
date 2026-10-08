const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// In development, ensure a default JWT_SECRET is available if not configured in .env
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  process.env.JWT_SECRET = 'servicedesk_pro_dev_jwt_secret_min_32_characters_default';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  console.log('[Security Notice] Using development JWT_SECRET fallback. In production, configure JWT_SECRET in .env.');
}

const app = require('./app');
const connectDB = require('./config/db');
const { startAutomationJobs } = require('./services/automationService');

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
const startServer = async () => {
  try {
    await connectDB();

    // Initialize background automation workers (72h auto-close & SLA monitoring)
    startAutomationJobs(60000);

    app.listen(PORT, () => {
      console.log(`ServiceDesk Pro API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
