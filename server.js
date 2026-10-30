// Node.js Express & SQLite Database Server for Coast Turtle's IT Land
// Run with: npm install && node server.js

require('dotenv').config();
const fs = require('fs');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');
const databaseDir = path.dirname(databasePath);

if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
}

// Middleware. The site and API share one origin, so no CORS headers are sent:
// other websites can't submit forms here from a visitor's browser.
app.set('trust proxy', 1); // Render sits behind a proxy; needed for the real visitor IP
app.use(express.json());

// Only website files are public. Everything else in this folder (database.db, server.js,
// package.json, render.yaml, DEPLOYMENT.md...) must never be downloadable.
const PUBLIC_FILE = /^\/(?:[\w-]+\.html|robots\.txt|sitemap\.xml|favicon\.ico|(?:css|js)\/[\w.-]+\.(?:css|js)|(?:images|img)\/[\w.-]+\.(?:png|jpe?g|webp|gif|svg|ico))?$/i;
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || PUBLIC_FILE.test(req.path)) return next();
    res.sendStatus(404);
});
app.use(express.static(path.join(__dirname)));

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

function isAdmin(req) {
    return Boolean(process.env.ADMIN_API_KEY) && req.get('x-admin-key') === process.env.ADMIN_API_KEY;
}

// Basic spam protection: each visitor can send a limited number of forms per window
const FORM_LIMIT = 10;
const FORM_WINDOW_MS = 15 * 60 * 1000;
const formSubmissions = new Map();

function limitFormSubmissions(req, res, next) {
    const now = Date.now();
    const recent = (formSubmissions.get(req.ip) || []).filter(time => now - time < FORM_WINDOW_MS);
    if (recent.length >= FORM_LIMIT) {
        return res.status(429).json({ error: 'Too many requests. Please try again later or call 07391580090.' });
    }
    recent.push(now);
    formSubmissions.set(req.ip, recent);
    next();
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of formSubmissions) {
        if (times.every(time => now - time >= FORM_WINDOW_MS)) formSubmissions.delete(ip);
    }
}, FORM_WINDOW_MS).unref();

// 1. Initialize SQLite Database
const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite Database:', err.message);
    } else {
        console.log(`Connected to SQLite Database (${databasePath})`);
    }
});

// Create Quotes Table if not exists
db.run(`
    CREATE TABLE IF NOT EXISTS service_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        services TEXT,
        estimate TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS customer_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review TEXT NOT NULL,
        photos TEXT,
        published INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        service TEXT NOT NULL,
        preferred_date TEXT NOT NULL,
        preferred_time TEXT NOT NULL,
        location TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS page_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 2. Email notifications to the owner.
// With a 16-character Gmail app password in EMAIL_PASS, mail is sent through Gmail.
// Otherwise it goes through FormSubmit, which only delivers once its one-time activation email is confirmed.
const OWNER_EMAIL = 'antoniosandu21@gmail.com';
const gmailUser = (process.env.EMAIL_USER || OWNER_EMAIL).trim();
const gmailPassword = (process.env.EMAIL_PASS || '').replace(/\s/g, '');
const emailMode = /^[a-zA-Z0-9]{16}$/.test(gmailPassword) ? 'gmail' : 'formsubmit';
const transporter = emailMode === 'gmail'
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPassword },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
    })
    : null;
console.log(`Email notifications: ${emailMode}`);

// fields: [label, value] pairs shown in the email. Resolves to { sent, error }.
async function notifyOwner(subject, fields) {
    try {
        if (emailMode === 'gmail') {
            const text = fields.map(([label, value]) => `${label}: ${value || 'Not specified'}`).join('\n');
            const html = `<h2>${escapeHtml(subject)}</h2>` + fields
                .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || 'Not specified')}</p>`)
                .join('');
            await transporter.sendMail({ from: `"Coast Turtle's IT Land Website" <${gmailUser}>`, to: OWNER_EMAIL, subject, text, html });
            return { sent: true };
        }

        const response = await fetch(`https://formsubmit.co/ajax/${OWNER_EMAIL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                _subject: subject,
                _template: 'table',
                _captcha: 'false',
                ...Object.fromEntries(fields.map(([label, value]) => [label, value || 'Not specified']))
            }),
            signal: AbortSignal.timeout(15000)
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && String(result.success) === 'true') return { sent: true };
        throw new Error(result.message || `FormSubmit responded with HTTP ${response.status}`);
    } catch (error) {
        console.error(`Email notification failed (${emailMode}):`, error.message);
        return { sent: false, error: error.message };
    }
}

// 3. API Endpoint to receive Quote Requests
app.post('/api/quotes', limitFormSubmissions, (req, res) => {
    const { name, phone, email, services, estimate, message } = req.body;

    if (!name || !phone || !email || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into SQLite Database
    const sql = `INSERT INTO service_quotes (name, phone, email, services, estimate, message) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [name, phone, email, services, estimate, message], function (err) {
        if (err) {
            console.error('SQLite insert error:', err.message);
            return res.status(500).json({ error: 'Failed to save to database' });
        }

        const quoteId = this.lastID;
        notifyOwner(`New repair request from ${name} (${phone})`, [
            ['Name', name], ['Phone', phone], ['Email', email],
            ['Services', services], ['Estimate', estimate], ['Message', message]
        ]).then(({ sent }) => {
            res.status(sent ? 201 : 202).json({
                success: true,
                emailSent: sent,
                quoteId,
                message: sent ? 'Quote recorded and email sent' : 'Quote recorded, but email delivery failed'
            });
        });
    });
});

// Admin-only: send a test notification and report exactly what happened
app.post('/api/admin/test-email', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required' });
    const result = await notifyOwner('Test email from your website', [
        ['Sent at', new Date().toISOString()], ['Delivery method', emailMode]
    ]);
    res.json({
        ...result,
        mode: emailMode,
        emailUser: emailMode === 'gmail' ? gmailUser : null,
        emailPassLength: gmailPassword.length
    });
});

// 4. API Endpoint to retrieve all Quotes from Database (Admin key required)
app.get('/api/quotes', (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required' });

    db.all(`SELECT * FROM service_quotes ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ quotes: rows });
    });
});

// 5. Customer reviews are held for approval in admin.html before appearing on the site.
// Photos are not accepted here; customers can send them by email instead.
app.post('/api/reviews', limitFormSubmissions, (req, res) => {
    const { name, rating, review } = req.body;
    const numericRating = Number(rating);

    if (typeof name !== 'string' || typeof review !== 'string' || !name.trim() || !review.trim()
        || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ error: 'Name, review, and a rating from 1 to 5 are required' });
    }

    const sql = `INSERT INTO customer_reviews (name, rating, review, photos, published) VALUES (?, ?, ?, '[]', 0)`;
    db.run(sql, [name.trim().slice(0, 100), numericRating, review.trim().slice(0, 700)], function (err) {
        if (err) {
            console.error('SQLite review insert error:', err.message);
            return res.status(500).json({ error: 'Failed to save review' });
        }
        res.status(201).json({ success: true, reviewId: this.lastID });
    });
});

app.get('/api/reviews', (req, res) => {
    db.all(`SELECT id, name, rating, review, created_at FROM customer_reviews WHERE published = 1 ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ reviews: rows });
    });
});

app.get('/api/admin/reviews', (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required' });
    db.all(`SELECT id, name, rating, review, published, created_at FROM customer_reviews ORDER BY published ASC, created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ reviews: rows });
    });
});

app.patch('/api/reviews/:id', (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required' });
    if (typeof req.body.published !== 'boolean') return res.status(400).json({ error: 'published must be true or false' });
    db.run(`UPDATE customer_reviews SET published = ? WHERE id = ?`, [req.body.published ? 1 : 0, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (!this.changes) return res.status(404).json({ error: 'Review not found' });
        res.json({ success: true });
    });
});

app.post('/api/bookings', limitFormSubmissions, (req, res) => {
    const { name, phone, email, service, preferredDate, preferredTime, location, notes = '' } = req.body;
    if (!name || !phone || !email || !service || !preferredDate || !preferredTime || !location) {
        return res.status(400).json({ error: 'Name, contact details, service, date, time, and location are required' });
    }

    const sql = `INSERT INTO appointments (name, phone, email, service, preferred_date, preferred_time, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [name, phone, email, service, preferredDate, preferredTime, location, notes], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to save appointment request' });

        const bookingId = this.lastID;
        notifyOwner(`New booking request from ${name}`, [
            ['Name', name], ['Phone', phone], ['Email', email], ['Service', service],
            ['Preferred', `${preferredDate} at ${preferredTime}`], ['Location', location], ['Notes', notes]
        ]).then(({ sent }) => {
            res.status(201).json({ success: true, bookingId, emailSent: sent, message: sent ? 'Booking request sent' : 'Booking saved; email delivery failed' });
        });
    });
});

app.post('/api/analytics', (req, res) => {
    const pathName = typeof req.body.path === 'string' ? req.body.path.slice(0, 200) : '/';
    db.run(`INSERT INTO page_events (path) VALUES (?)`, [pathName], err => {
        if (err) return res.sendStatus(500);
        res.sendStatus(204);
    });
});

app.get('/api/bookings', (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required' });
    db.all(`SELECT * FROM appointments ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ bookings: rows });
    });
});

app.patch('/api/bookings/:id', (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required' });
    const allowedStatuses = ['new', 'confirmed', 'completed', 'cancelled'];
    const { status } = req.body;
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid booking status' });
    db.run(`UPDATE appointments SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (!this.changes) return res.status(404).json({ error: 'Booking not found' });
        res.json({ success: true });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Coast Turtle's IT Land Server running on http://localhost:${PORT}`);
});
