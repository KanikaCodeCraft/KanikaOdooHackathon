const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper to log audit actions
function logAudit(action, details, loggedBy = 'System Backend') {
    db.run(
        `INSERT INTO audit_logs (action, details, logged_by) VALUES (?, ?, ?)`,
        [action, details, loggedBy],
        (err) => {
            if (err) {
                console.error('Audit Logging Error:', err.message);
            }
        }
    );
}

// REST route to get audits
router.get('/', (req, res, next) => {
    // Dynamic require to resolve circular dependency at startup
    const { authenticateToken } = require('./auth');
    return authenticateToken(req, res, next);
}, (req, res) => {
    // Return last 50 audit log entries sorted by ID descending
    db.all(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
module.exports.logAudit = logAudit;
