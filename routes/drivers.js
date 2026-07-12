const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('./auth');

// 1. GET /api/drivers - Read all drivers (Supports status filtering for dashboard/dispatch)
router.get('/', authenticateToken, (req, res) => {
    let query = `SELECT * FROM drivers WHERE 1=1`;
    const params = [];

    if (req.query.status) {
        query += ` AND status = ?`;
        params.push(req.query.status);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. POST /api/drivers - Add a new driver profile
router.post('/', authenticateToken, authorizeRoles('Fleet Manager', 'Safety Officer'), (req, res) => {
    const { name, license_number, license_category, license_expiry_date, contact_number, safety_score } = req.body;

    if (!name || !license_number || !license_category || !license_expiry_date || !contact_number) {
        return res.status(400).json({ error: 'Missing mandatory driver details' });
    }

    const query = `INSERT INTO drivers (name, license_number, license_category, license_expiry_date, contact_number, safety_score, status)
                   VALUES (?, ?, ?, ?, ?, ?, 'Available')`;

    db.run(query, [name, license_number, license_category, license_expiry_date, contact_number, safety_score || 5.0], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'License number must be unique' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: 'Driver profile created successfully' });
    });
});

// 3. PUT /api/drivers/:id/safety - Quick update for Safety Scores
router.put('/:id/safety', authenticateToken, authorizeRoles('Safety Officer'), (req, res) => {
    const { safety_score, status } = req.body;
    
    if (safety_score === undefined) return res.status(400).json({ error: 'Safety score value required' });

    db.run(`UPDATE drivers SET safety_score = ?, status = COALESCE(?, status) WHERE id = ?`, 
        [safety_score, status, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Driver validation parameters updated' });
        });
});

// 4. DELETE /api/drivers/:id - Remove a driver profile
router.delete('/:id', authenticateToken, authorizeRoles('Fleet Manager'), (req, res) => {
    db.run(`DELETE FROM drivers WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Driver profile removed from system' });
    });
});

module.exports = router;