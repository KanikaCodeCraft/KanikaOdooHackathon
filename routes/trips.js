const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('./auth');
const { logAudit } = require('./audit');

// 1. GET /api/trips - Retrieve all trips
router.get('/', authenticateToken, (req, res) => {
    db.all(`SELECT t.*, v.registration_number, d.name as driver_name 
            FROM trips t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. POST /api/trips - Create a Draft Trip
router.post('/', authenticateToken, authorizeRoles('Fleet Manager', 'Driver'), (req, res) => {
    const { source, destination, vehicle_id, driver_id, cargo_weight, planned_distance } = req.body;

    if (!source || !destination || !vehicle_id || !driver_id || !cargo_weight || !planned_distance) {
        return res.status(400).json({ error: 'Missing required trip parameters' });
    }

    // Business Rules Verification Layer
    db.get(`SELECT status, max_load_capacity FROM vehicles WHERE id = ?`, [vehicle_id], (err, vehicle) => {
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        if (vehicle.status === 'In Shop' || vehicle.status === 'Retired') {
            return res.status(400).json({ error: 'Retired or In Shop vehicles cannot be assigned to trips' });
        }
        if (cargo_weight > vehicle.max_load_capacity) {
            return res.status(400).json({ error: `Cargo weight exceeds vehicle's maximum load capacity of ${vehicle.max_load_capacity} kg` });
        }

        db.get(`SELECT status, license_expiry_date FROM drivers WHERE id = ?`, [driver_id], (err, driver) => {
            if (!driver) return res.status(404).json({ error: 'Driver not found' });
            if (driver.status === 'Suspended') {
                return res.status(400).json({ error: 'Suspended drivers cannot be assigned to trips' });
            }
            
            // Check for expired license (Compare dates)
            const today = new Date().toISOString().split('T')[0];
            if (driver.license_expiry_date < today) {
                return res.status(400).json({ error: 'Drivers with expired licenses cannot be assigned to trips' });
            }

            // All checks passed -> Insert as Draft
            const query = `INSERT INTO trips (source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, status)
                           VALUES (?, ?, ?, ?, ?, ?, 'Draft')`;
            db.run(query, [source, destination, vehicle_id, driver_id, cargo_weight, planned_distance], function(insertErr) {
                if (insertErr) return res.status(500).json({ error: insertErr.message });
                logAudit('Trip Created', `Draft Trip #${this.lastID} created from ${source} to ${destination} (Cargo: ${cargo_weight} kg).`, req.user.email);
                res.status(201).json({ id: this.lastID, status: 'Draft', message: 'Trip created in draft mode' });
            });
        });
    });
});

// 3. PUT /api/trips/:id/dispatch - Dispatch Trip Workflow
router.put('/:id/dispatch', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    const tripId = req.params.id;

    db.get(`SELECT * FROM trips WHERE id = ?`, [tripId], (err, trip) => {
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        if (trip.status !== 'Draft') return res.status(400).json({ error: 'Only draft trips can be dispatched' });

        // Double check resource availability right before atomic deployment
        db.get(`SELECT status FROM vehicles WHERE id = ?`, [trip.vehicle_id], (err, vehicle) => {
            db.get(`SELECT status FROM drivers WHERE id = ?`, [trip.driver_id], (err, driver) => {
                if (vehicle.status === 'On Trip' || driver.status === 'On Trip') {
                    return res.status(400).json({ error: 'Vehicle or Driver is already actively assigned to an ongoing trip' });
                }

                db.serialize(() => {
                    db.run(`UPDATE trips SET status = 'Dispatched' WHERE id = ?`, [tripId]);
                    db.run(`UPDATE vehicles SET status = 'On Trip' WHERE id = ?`, [trip.vehicle_id]);
                    db.run(`UPDATE drivers SET status = 'On Trip' WHERE id = ?`, [trip.driver_id]);
                    logAudit('Trip Dispatched', `Trip #${tripId} has been dispatched. Assigned Vehicle ID: ${trip.vehicle_id}, Driver ID: ${trip.driver_id}.`, req.user.email);
                    res.json({ message: 'Trip dispatched successfully. Vehicle and driver marked On Trip.' });
                });
            });
        });
    });
});

// 4. PUT /api/trips/:id/complete - Complete Trip Workflow
router.put('/:id/complete', authenticateToken, authorizeRoles('Fleet Manager', 'Driver'), (req, res) => {
    const tripId = req.params.id;
    const { final_odometer, fuel_liters, fuel_cost } = req.body;

    if (!final_odometer) return res.status(400).json({ error: 'Final odometer reading required to complete trip' });

    db.get(`SELECT * FROM trips WHERE id = ?`, [tripId], (err, trip) => {
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        if (trip.status !== 'Dispatched') return res.status(400).json({ error: 'Only dispatched trips can be completed' });

        db.serialize(() => {
            // Update trip lifecycle status
            db.run(`UPDATE trips SET status = 'Completed' WHERE id = ?`, [tripId]);
            // Re-release resources back to pool
            db.run(`UPDATE vehicles SET status = 'Available', odometer = ? WHERE id = ?`, [final_odometer, trip.vehicle_id]);
            db.run(`UPDATE drivers SET status = 'Available' WHERE id = ?`, [trip.driver_id]);

            // If fuel log is supplied, parse expense instantly
            if (fuel_liters && fuel_cost) {
                db.run(`INSERT INTO fuel_expense_logs (vehicle_id, trip_id, log_type, liters, cost) VALUES (?, ?, 'Fuel', ?, ?)`,
                    [trip.vehicle_id, tripId, fuel_liters, fuel_cost]);
            }

            logAudit('Trip Completed', `Trip #${tripId} completed successfully. Final Odometer: ${final_odometer} km.${fuel_cost ? ` Registered fuel transaction of ₹${fuel_cost} (${fuel_liters} L).` : ''}`, req.user.email);
            res.json({ message: 'Trip completed safely. Assets restored to Available status.' });
        });
    });
});

// 5. PUT /api/trips/:id/cancel - Cancel Trip Workflow
router.put('/:id/cancel', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    const tripId = req.params.id;

    db.get(`SELECT * FROM trips WHERE id = ?`, [tripId], (err, trip) => {
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        db.serialize(() => {
            db.run(`UPDATE trips SET status = 'Cancelled' WHERE id = ?`, [tripId]);
            if (trip.status === 'Dispatched') {
                db.run(`UPDATE vehicles SET status = 'Available' WHERE id = ?`, [trip.vehicle_id]);
                db.run(`UPDATE drivers SET status = 'Available' WHERE id = ?`, [trip.driver_id]);
            }
            logAudit('Trip Cancelled', `Trip #${tripId} has been cancelled. Associated active assets released.`, req.user.email);
            res.json({ message: 'Trip cancelled. Assets rolled back to Available.' });
        });
    });
});

module.exports = router;