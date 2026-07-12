const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

// 1. Authentication Middleware to verify token and extract user data
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// 2. RBAC Middleware to restrict access based on user role
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied: Unauthorized role privileges' });
        }
        next();
    };
}

// 3. POST /api/auth/login Endpoint
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        // Check password match
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

        // Generate JWT token containing ID and Role for RBAC checks
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '4h' } // Token lasts exactly as long as our hackathon countdown!
        );

        res.json({
            message: 'Authentication successful',
            token,
            user: { email: user.email, role: user.role }
        });
    });
});

// Export endpoints and middlewares for use in other routes
module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.authorizeRoles = authorizeRoles;