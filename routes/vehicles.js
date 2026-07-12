const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('./auth');
const { logAudit } = require('./audit');

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

// 2. GET /api/vehicles/dashboard/kpis - Unified operational metrics (CRITICAL: Placed above /:id parameters)
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
                if (err) return res.status(500).json({ error: err.message });
                
                metrics.total_vehicles = vRow.total || 0;
                metrics.available_vehicles = vRow.available || 0;
                metrics.active_vehicles = vRow.active || 0;
                metrics.vehicles_in_maintenance = vRow.shop || 0;
                metrics.fleet_utilization_percent = vRow.total > 0 ? Math.round((vRow.active / vRow.total) * 100) : 0;
        });

        // B. Trip States
        db.get(`SELECT 
            COUNT(CASE WHEN status = 'Dispatched' THEN 1 END) as active_trips,
            COUNT(CASE WHEN status = 'Draft' THEN 1 END) as pending_trips
            FROM trips`, [], (err, tRow) => {
                if (err) return res.status(500).json({ error: err.message });

                metrics.active_trips = tRow.active_trips || 0;
                metrics.pending_trips = tRow.pending_trips || 0;
        });

        // C. Driver Statuses
        db.get(`SELECT COUNT(*) as active_drivers FROM drivers WHERE status = 'On Trip'`, [], (err, dRow) => {
            if (err) return res.status(500).json({ error: err.message });

            metrics.drivers_on_duty = dRow.active_drivers || 0;
            
            // Send the completed unified metric package back cleanly
            res.json(metrics);
        });
    });
});

// 3. POST /api/vehicles - Create vehicle (Enforces Fleet Manager access)
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
        logAudit('Vehicle Created', `Vehicle ${registration_number} (${model}) added to fleet asset registry.`, req.user.email);
        res.status(201).json({ id: this.lastID, message: 'Vehicle registered successfully' });
    });
});

// 4. POST /api/vehicles/:id/maintenance - Log Maintenance Workflow
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
            logAudit('Maintenance Initiated', `Vehicle ID ${vehicleId} sent to shop: ${description} (Est. cost: ₹${cost || 0}).`, req.user.email);
            res.json({ message: 'Vehicle sent to maintenance. Status updated to In Shop.' });
        });
    });
});

// 5. PUT /api/vehicles/:id/maintenance/close - Close Maintenance Workflow
router.put('/:id/maintenance/close', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    const vehicleId = req.params.id;

    db.serialize(() => {
        // Step A: Close active logs for this vehicle
        db.run(`UPDATE maintenance_logs SET is_closed = 1 WHERE vehicle_id = ? AND is_closed = 0`, [vehicleId]);

        // Step B: Set status back to 'Available'
        db.run(`UPDATE vehicles SET status = 'Available' WHERE id = ? AND status = 'In Shop'`, [vehicleId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit('Maintenance Resolved', `Vehicle ID ${vehicleId} maintenance closed. Status restored to Available.`, req.user.email);
            res.json({ message: 'Maintenance completed. Vehicle is now Available.' });
        });
    });
});

// 6. DELETE /api/vehicles/:id - Retire/Remove asset
router.delete('/:id', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    db.run(`DELETE FROM vehicles WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit('Vehicle Deleted', `Vehicle ID ${req.params.id} has been retired/deleted from the database.`, req.user.email);
        res.json({ message: 'Vehicle deleted from database' });
    });
});

// 7. GET /api/vehicles/maintenance/logs - Get all maintenance logs
router.get('/maintenance/logs', authenticateToken, (req, res) => {
    db.all(`SELECT m.*, v.registration_number, v.model FROM maintenance_logs m 
            JOIN vehicles v ON m.vehicle_id = v.id 
            ORDER BY m.id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;