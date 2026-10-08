const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  process.env.JWT_SECRET = 'servicedesk_pro_dev_jwt_secret_min_32_characters_default';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
}

const express = require('express');
const cors = require('cors');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
const corsOptions = process.env.CORS_ORIGIN
  ? {
      origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'ServiceDesk Pro API is running',
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Ticket and Category routes
const ticketRoutes = require('./routes/ticketRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const assetRoutes = require('./routes/assetRoutes');
const knowledgeArticleRoutes = require('./routes/knowledgeArticleRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/tickets', ticketRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/knowledge-base', knowledgeArticleRoutes);
app.use('/api/users', userRoutes);

// 404 handler for unmatched routes
app.use(notFound);

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
