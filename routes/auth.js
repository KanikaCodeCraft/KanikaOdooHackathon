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

        // Check password match against the hashed store column
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

        // Generate JWT token containing ID and Role for RBAC checks
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '4h' }
        );

        res.json({
            message: 'Authentication successful',
            token,
            user: { email: user.email, role: user.role }
        });
    });
});

// 4. POST /api/auth/register Endpoint (RBAC PROVISIONING)
// --- ADMINISTRATIVE USER REGISTRATION (RBAC PROVISIONING) ---
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body; // 'name' will be bypassed for the query since the schema doesn't have it

    // 1. Enforce strict parameter presence validation rules
    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, password, and role fields are required.' });
    }

    try {
        // 2. Check if a user configuration with this profile email exists
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, existingUser) => {
            if (err) {
                console.error('Database pre-fetch execution check error:', err);
                return res.status(500).json({ error: 'Internal database processing failure.' });
            }
            
            if (existingUser) {
                return res.status(400).json({ error: 'An account with this email address already exists.' });
            }

            // Encrypt user passwords securely before storing to match the login verification workflow
            const salt = bcrypt.genSaltSync(10);
            const hashedPasswordHash = bcrypt.hashSync(password, salt);

            // 3. Insert credentials omitting the unsupported 'name' column
            const insertQuery = `
                INSERT INTO users (email, password_hash, role)
                VALUES (?, ?, ?)
            `;

            db.run(insertQuery, [email, hashedPasswordHash, role], function (insertErr) {
                if (insertErr) {
                    console.error('Database account insertion run statement error:', insertErr);
                    return res.status(500).json({ error: `Database Error: ${insertErr.message}` });
                }

                // 4. Return successful response payload back to client
                return res.status(201).json({
                    success: true,
                    message: 'Operational account profile authorized successfully.'
                });
            });
        });

    } catch (error) {
        console.error('Unexpected crash inside user registration router block:', error);
        return res.status(500).json({ error: 'Internal server error while processing new user account.' });
    }
});

// Export endpoints router and validation modules for server integration
module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.authorizeRoles = authorizeRoles;