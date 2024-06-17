const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

class DBManager {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Failed to connect to database:', err);
            } else {
                console.log('Connected to database');
                this.initialize();
            }
        });
    }

    initialize() {
        this.db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`, (err) => {
            if (err) {
                console.error('Failed to create users table:', err);
            } else {
                this.createDefaultUser();
            }
        });
    }

    async createDefaultUser() {
        const defaultUsername = 'admin';
        const defaultPassword = 'password';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        this.db.get(`SELECT COUNT(*) AS count FROM users`, (err, row) => {
            if (row.count === 0) {
                this.db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [defaultUsername, hashedPassword], (err) => {
                    if (err) {
                        console.error('Failed to create default user:', err);
                    } else {
                        console.log('Default user created');
                    }
                });
            }
        });
    }

    createUser(username, password, callback) {
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return callback(err);
            this.db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], callback);
        });
    }

    authenticateUser(username, password, callback) {
        this.db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
            if (err) return callback(err);
            if (!user) return callback(null, false);

            bcrypt.compare(password, user.password, (err, result) => {
                if (err) return callback(err);
                if (result) return callback(null, user);
                else return callback(null, false);
            });
        });
    }

    getAllUsers(callback) {
        this.db.all(`SELECT id, username FROM users`, callback);
    }

    deleteUser(userId, callback) {
        this.db.run(`DELETE FROM users WHERE id = ?`, [userId], callback);
    }
}

module.exports = DBManager;