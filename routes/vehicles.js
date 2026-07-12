const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('./auth');

// 1. GET /api/vehicles - Read all vehicles (Supports status/type filtering for Dashboard)
router.get('/', authenticateToken, (req, res) => {
    let query = `SELECT * FROM vehicles WHERE 1=1`;
    const params = [];

    if (req.query.status) {
        query += ` AND status = ?`;
        params.push(req.query.status);
    }
    if (req.query.type) {
        query += ` AND type = ?`;
        params.push(req.query.type);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. POST /api/vehicles - Create vehicle (Enforces Fleet Manager access)
router.post('/', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    const { registration_number, model, type, max_load_capacity, odometer, acquisition_cost } = req.body;

    if (!registration_number || !model || !type || !max_load_capacity || !acquisition_cost) {
        return res.status(400).json({ error: 'Missing mandatory vehicle fields' });
    }

    const query = `INSERT INTO vehicles (registration_number, model, type, max_load_capacity, odometer, acquisition_cost, status) 
                   VALUES (?, ?, ?, ?, ?, ?, 'Available')`;
    
    db.run(query, [registration_number, model, type, max_load_capacity, odometer || 0, acquisition_cost], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Vehicle registration number must be unique' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: 'Vehicle registered successfully' });
    });
});

// 3. POST /api/vehicles/:id/maintenance - Log Maintenance Workflow
// Mandatory Rule: Creating maintenance automatically forces vehicle status to 'In Shop'
router.post('/:id/maintenance', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    const vehicleId = req.params.id;
    const { description, cost } = req.body;

    if (!description) return res.status(400).json({ error: 'Maintenance description required' });

    db.serialize(() => {
        // Step A: Insert maintenance record
        db.run(`INSERT INTO maintenance_logs (vehicle_id, description, cost, is_closed) VALUES (?, ?, ?, 0)`, 
            [vehicleId, description, cost || 0]);

        // Step B: Atomically transition vehicle status to 'In Shop'
        db.run(`UPDATE vehicles SET status = 'In Shop' WHERE id = ?`, [vehicleId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Vehicle sent to maintenance. Status updated to In Shop.' });
        });
    });
});

// 4. PUT /api/vehicles/:id/maintenance/close - Close Maintenance Workflow
// Mandatory Rule: Closing maintenance restores vehicle to 'Available'
router.put('/:id/maintenance/close', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    const vehicleId = req.params.id;

    db.serialize(() => {
        // Step A: Close active logs for this vehicle
        db.run(`UPDATE maintenance_logs SET is_closed = 1 WHERE vehicle_id = ? AND is_closed = 0`, [vehicleId]);

        // Step B: Set status back to 'Available'
        db.run(`UPDATE vehicles SET status = 'Available' WHERE id = ? AND status = 'In Shop'`, [vehicleId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Maintenance completed. Vehicle is now Available.' });
        });
    });
});

// 5. DELETE /api/vehicles/:id - Retire/Remove asset
router.delete('/:id', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    db.run(`DELETE FROM vehicles WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Vehicle deleted from database' });
    });
});

// GET /api/vehicles/dashboard/kpis - Unified operational metrics (Section 3.2)
router.get('/dashboard/kpis', authenticateToken, (req, res) => {
    const metrics = {};

    db.serialize(() => {
        // A. Vehicle States
        db.get(`SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'Available' THEN 1 END) as available,
            COUNT(CASE WHEN status = 'On Trip' THEN 1 END) as active,
            COUNT(CASE WHEN status = 'In Shop' THEN 1 END) as shop
            FROM vehicles`, [], (err, vRow) => {
                metrics.total_vehicles = vRow.total;
                metrics.available_vehicles = vRow.available;
                metrics.active_vehicles = vRow.active;
                metrics.vehicles_in_maintenance = vRow.shop;
                metrics.fleet_utilization_percent = vRow.total > 0 ? Math.round((vRow.active / vRow.total) * 100) : 0;
        });

        // B. Trip States (Section 3.2 & 3.5)
        db.get(`SELECT 
            COUNT(CASE WHEN status = 'Dispatched' THEN 1 END) as active_trips,
            COUNT(CASE WHEN status = 'Draft' THEN 1 END) as pending_trips
            FROM trips`, [], (err, tRow) => {
                metrics.active_trips = tRow.active_trips;
                metrics.pending_trips = tRow.pending_trips;
        });

        // C. Driver Statuses (Section 3.2 & 3.4)
        db.get(`SELECT COUNT(*) as active_drivers FROM drivers WHERE status = 'On Trip'`, [], (err, dRow) => {
            metrics.drivers_on_duty = dRow.active_drivers;
            
            // Send the completed metric package back
            res.json(metrics);
        });
    });
});

module.exports = router;