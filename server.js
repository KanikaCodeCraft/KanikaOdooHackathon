require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database'); // Ensures db tables are initialized immediately
const expenseRoutes = require('./routes/expenses');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fallback JWT Secret if not provided in .env
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'super-secret-hackathon-key-change-in-prod';
}

// Route Modules
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const tripRoutes = require('./routes/trips');

// API Mountpoints
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/expenses', expenseRoutes);

// SPA Routing: Redirect any non-API request back to our main HTML shell
app.get('*all', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Start the Engines
app.listen(PORT, () => {
    console.log(`🚀 TransitOps engine running smoothly at http://localhost:${PORT}`);
});