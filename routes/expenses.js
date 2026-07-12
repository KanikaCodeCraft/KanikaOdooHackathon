const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('./auth');

// 1. POST /api/expenses/fuel - Record a fuel log (Section 3.7)
router.post('/fuel', authenticateToken, authorizeRoles('Fleet Manager', 'Driver'), (req, res) => {
    const { vehicle_id, trip_id, liters, cost, date } = req.body;

    if (!vehicle_id || !liters || !cost) {
        return res.status(400).json({ error: 'Vehicle ID, liters, and cost are required' });
    }

    const query = `INSERT INTO fuel_expense_logs (vehicle_id, trip_id, log_type, liters, cost, logged_date) 
                   VALUES (?, ?, 'Fuel', ?, ?, COALESCE(?, CURRENT_DATE))`;

    db.run(query, [vehicle_id, trip_id || null, liters, cost, date || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, message: 'Fuel log recorded successfully' });
    });
});

// 2. POST /api/expenses/other - Record tolls or general maintenance costs (Section 3.7)
router.post('/other', authenticateToken, authorizeRoles('Fleet Manager', 'Financial Analyst'), (req, res) => {
    const { vehicle_id, log_type, cost, date } = req.body; // log_type: 'Toll' or 'Other'

    if (!vehicle_id || !log_type || !cost) {
        return res.status(400).json({ error: 'Vehicle ID, type (Toll/Other), and cost are required' });
    }

    const query = `INSERT INTO fuel_expense_logs (vehicle_id, log_type, cost, logged_date) 
                   VALUES (?, ?, ?, COALESCE(?, CURRENT_DATE))`;

    db.run(query, [vehicle_id, log_type, cost, date || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, message: 'Expense logged successfully' });
    });
});

// 3. GET /api/expenses/analytics - High-impact reports (Section 3.8)
router.get('/analytics', authenticateToken, authorizeRoles('Fleet Manager', 'Financial Analyst'), (req, res) => {
    const query = `
        SELECT 
            v.id,
            v.registration_number,
            v.model,
            v.acquisition_cost,
            COALESCE(SUM(DISTINCT t.planned_distance), 0) as total_distance,
            COALESCE(SUM(CASE WHEN f.log_type = 'Fuel' THEN f.liters END), 0) as total_liters,
            COALESCE(SUM(CASE WHEN f.log_type = 'Fuel' THEN f.cost END), 0) as total_fuel_cost,
            COALESCE(SUM(DISTINCT m.cost), 0) as total_maintenance_cost,
            COALESCE(SUM(CASE WHEN f.log_type != 'Fuel' THEN f.cost END), 0) as other_costs
        FROM vehicles v
        LEFT JOIN trips t ON v.id = t.vehicle_id AND t.status = 'Completed'
        LEFT JOIN fuel_expense_logs f ON v.id = f.vehicle_id
        LEFT JOIN maintenance_logs m ON v.id = m.vehicle_id
        GROUP BY v.id
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Enforce the mandatory formulas programmatically (Section 3.8)
        const reports = rows.map(row => {
            const totalOpCost = row.total_fuel_cost + row.total_maintenance_cost + row.other_costs;
            const fuelEfficiency = row.total_liters > 0 ? (row.total_distance / row.total_liters).toFixed(2) : 0;
            
            // Assume a baseline market operational revenue generated per km to compute dynamic ROI value
            const simulatedRevenue = row.total_distance * 50; 
            const roi = (((simulatedRevenue - (row.total_maintenance_cost + row.total_fuel_cost)) / row.acquisition_cost) * 100).toFixed(2);

            return {
                vehicle_id: row.id,
                registration_number: row.registration_number,
                model: row.model,
                total_operational_cost: totalOpCost,
                fuel_efficiency_km_l: fuelEfficiency,
                vehicle_roi_percentage: `${roi}%`
            };
        });

        res.json(reports);
    });
});

// 4. GET /api/expenses/fuel - Get all fuel logs
router.get('/fuel', authenticateToken, (req, res) => {
    db.all(`SELECT f.*, v.registration_number FROM fuel_expense_logs f 
            JOIN vehicles v ON f.vehicle_id = v.id 
            WHERE f.log_type = 'Fuel' 
            ORDER BY f.id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;