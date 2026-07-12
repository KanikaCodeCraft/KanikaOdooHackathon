const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'transitops.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // 1. USERS TABLE
        // 1. UPDATE THE VALID ENUM PRIVILEGES IN database.js
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT CHECK(role IN ('Fleet Manager', 'Dispatcher', 'Driver', 'Safety Officer', 'Financial Analyst')) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        // 2. VEHICLES TABLE
        db.run(`CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_number TEXT UNIQUE NOT NULL,
            model TEXT NOT NULL,
            type TEXT NOT NULL,
            max_load_capacity REAL NOT NULL,
            odometer REAL NOT NULL DEFAULT 0.0,
            acquisition_cost REAL NOT NULL,
            status TEXT CHECK(status IN ('Available', 'On Trip', 'In Shop', 'Retired')) DEFAULT 'Available'
        )`);

        // 3. DRIVERS TABLE
        db.run(`CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            license_number TEXT UNIQUE NOT NULL,
            license_category TEXT NOT NULL,
            license_expiry_date TEXT NOT NULL, -- YYYY-MM-DD
            contact_number TEXT NOT NULL,
            safety_score REAL DEFAULT 5.0,
            status TEXT CHECK(status IN ('Available', 'On Trip', 'Off Duty', 'Suspended')) DEFAULT 'Available'
        )`);

        // 4. TRIPS TABLE
        db.run(`CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            destination TEXT NOT NULL,
            vehicle_id INTEGER,
            driver_id INTEGER,
            cargo_weight REAL NOT NULL,
            planned_distance REAL NOT NULL,
            status TEXT CHECK(status IN ('Draft', 'Dispatched', 'Completed', 'Cancelled')) DEFAULT 'Draft',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
            FOREIGN KEY (driver_id) REFERENCES drivers(id)
        )`);

        // 5. MAINTENANCE LOGS
        db.run(`CREATE TABLE IF NOT EXISTS maintenance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER,
            description TEXT NOT NULL,
            cost REAL DEFAULT 0.0,
            is_closed INTEGER DEFAULT 0, -- 0 for false, 1 for true
            logged_at TEXT DEFAULT CURRENT_DATE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        )`);

        // 6. FUEL & EXPENSE LOGS
        db.run(`CREATE TABLE IF NOT EXISTS fuel_expense_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER,
            trip_id INTEGER,
            log_type TEXT CHECK(log_type IN ('Fuel', 'Toll', 'Other')),
            liters REAL,
            cost REAL NOT NULL,
            logged_date TEXT DEFAULT CURRENT_DATE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
            FOREIGN KEY (trip_id) REFERENCES trips(id)
        )`, () => {
            // 7. AUDIT LOGS
            db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                details TEXT NOT NULL,
                logged_by TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, () => {
                db.get(`SELECT id FROM audit_logs LIMIT 1`, (err, row) => {
                    if (!row) {
                        db.run(`INSERT INTO audit_logs (action, details, logged_by) VALUES (?, ?, ?)`,
                            ['Database Initialize', 'Audit logger system activated.', 'System Backend'],
                            () => {
                                seedDefaultUser();
                            }
                        );
                    } else {
                        seedDefaultUser();
                    }
                });
            });
        });
    });
}

function seedDefaultUser() {
    const defaultEmail = 'admin@transitops.com';
    const defaultPassword = 'adminpassword';
    const role = 'Fleet Manager';

    db.get(`SELECT id FROM users WHERE email = ?`, [defaultEmail], (err, row) => {
        if (!row) {
            const hash = bcrypt.hashSync(defaultPassword, 10);
            db.run(
                `INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)`,
                [defaultEmail, hash, role],
                (insertErr) => {
                    if (insertErr) console.error('Seeding error:', insertErr.message);
                    else console.log(`Database seeded! Default login: ${defaultEmail} / ${defaultPassword}`);
                }
            );
        }
    });
}

module.exports = db;