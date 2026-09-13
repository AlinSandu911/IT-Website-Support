// Node.js Express & SQLite Database Server for Coast Turtle's IT Land
// Run with: npm install && node server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. Initialize SQLite Database
const databasePath = process.env.DATABASE_PATH || './database.db';
const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite Database:', err.message);
    } else {
        console.log('Connected to SQLite Database (database.db)');
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
        published INTEGER NOT NULL DEFAULT 1,
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

// 2. Transporter for sending Emails to antoniosandu21@gmail.com
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'antoniosandu21@gmail.com',
        pass: process.env.EMAIL_PASS || 'YOUR_GMAIL_APP_PASSWORD' // Replace with Gmail App Password if running Node server
    }
});

async function sendViaFormSubmit(mailData) {
    const response = await fetch('https://formsubmit.co/ajax/antoniosandu21@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            _subject: mailData.subject,
            _template: 'table',
            _captcha: false,
            name: mailData.name,
            phone: mailData.phone,
            email: mailData.email,
            services: mailData.services || 'Not specified',
            estimate: mailData.estimate || 'Not specified',
            message: mailData.message
        })
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.success !== false;
}

// 3. API Endpoint to receive Quote Requests
app.post('/api/quotes', (req, res) => {
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

        console.log(`New quote saved to database with ID: ${this.lastID}`);

        // Send Email Notification to Antonio
        const mailOptions = {
            from: '"Coast Turtle's IT Land Website" <antoniosandu21@gmail.com>',
            to: 'antoniosandu21@gmail.com',
            subject: `New Repair Request from ${name} (${phone})`,
            html: `
                <h2>New Service Request Received</h2>
                <p><strong>Customer Name:</strong> ${name}</p>
                <p><strong>Phone Number:</strong> <a href="tel:${phone}">${phone}</a></p>
                <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                <p><strong>Services Required:</strong> ${services || 'N/A'}</p>
                <p><strong>Calculated Estimate:</strong> ${estimate || 'N/A'}</p>
                <p><strong>Message / Description:</strong></p>
                <p style="background:#f1f5f9; padding:12px; border-radius:8px;">${message}</p>
            `
        };

        const emailPassword = (process.env.EMAIL_PASS || '').replace(/\s/g, '');
        const hasGmailAppPassword = /^[a-zA-Z0-9]{16}$/.test(emailPassword);
        if (!hasGmailAppPassword) {
            sendViaFormSubmit({
                subject: `New IT Repair Request from ${name} (${phone})`,
                name,
                phone,
                email,
                services,
                estimate,
                message
            }).then(emailSent => {
                res.status(emailSent ? 201 : 202).json({
                    success: true,
                    emailSent,
                    quoteId: this.lastID,
                    message: emailSent
                        ? 'Quote recorded and email submitted'
                        : 'Quote recorded, but email delivery failed'
                });
            }).catch(error => {
                console.error('FormSubmit delivery failed:', error.message);
                res.status(202).json({ success: true, emailSent: false, quoteId: this.lastID, message: 'Quote recorded, but email delivery failed' });
            });
            return;
        }

        transporter.sendMail(mailOptions, (mailErr, info) => {
            if (mailErr) {
                console.error('Quote email failed:', mailErr.message);
                return res.status(202).json({
                    success: true,
                    emailSent: false,
                    quoteId: this.lastID,
                    message: 'Quote recorded, but email delivery failed'
                });
            } else {
                console.log('Email sent:', info.response);
                return res.status(201).json({
                    success: true,
                    emailSent: true,
                    quoteId: this.lastID,
                    message: 'Quote recorded and email dispatched'
                });
            }
        });
    });
});

// 4. API Endpoint to retrieve all Quotes from Database (Admin key required)
app.get('/api/quotes', (req, res) => {
    const suppliedKey = req.get('x-admin-key');
    if (!process.env.ADMIN_API_KEY || suppliedKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }

    db.all(`SELECT * FROM service_quotes ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ quotes: rows });
    });
});

// 5. Customer reviews are published immediately and mirrored on the Home page
app.post('/api/reviews', (req, res) => {
    const { name, rating, review, photos = [] } = req.body;
    const numericRating = Number(rating);

    if (!name || !review || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ error: 'Name, review, and a rating from 1 to 5 are required' });
    }

    const sql = `INSERT INTO customer_reviews (name, rating, review, photos) VALUES (?, ?, ?, ?)`;
    db.run(sql, [name, numericRating, review, JSON.stringify(Array.isArray(photos) ? photos : [])], function (err) {
        if (err) {
            console.error('SQLite review insert error:', err.message);
            return res.status(500).json({ error: 'Failed to save review' });
        }
        res.status(201).json({ success: true, reviewId: this.lastID });
    });
});

app.get('/api/reviews', (req, res) => {
    db.all(`SELECT id, name, rating, review, photos, created_at FROM customer_reviews WHERE published = 1 ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ reviews: rows.map(row => ({ ...row, photos: JSON.parse(row.photos || '[]') })) });
    });
});

app.post('/api/bookings', (req, res) => {
    const { name, phone, email, service, preferredDate, preferredTime, location, notes = '' } = req.body;
    if (!name || !phone || !email || !service || !preferredDate || !preferredTime || !location) {
        return res.status(400).json({ error: 'Name, contact details, service, date, time, and location are required' });
    }

    const sql = `INSERT INTO appointments (name, phone, email, service, preferred_date, preferred_time, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [name, phone, email, service, preferredDate, preferredTime, location, notes], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to save appointment request' });

        const bookingId = this.lastID;
        const mailData = {
            subject: `New booking request from ${name}`,
            name,
            phone,
            email,
            services: service,
            estimate: `${preferredDate} at ${preferredTime} | ${location}`,
            message: notes || 'No additional notes provided'
        };

        const notifyOwner = process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'YOUR_GMAIL_APP_PASSWORD'
            ? new Promise(resolve => transporter.sendMail({
                from: `"Coast Turtle's IT Land Website" <${process.env.EMAIL_USER || 'antoniosandu21@gmail.com'}>`,
                to: 'antoniosandu21@gmail.com',
                subject: mailData.subject,
                text: `Name: ${name}\nPhone: ${phone}\nEmail: ${email}\nService: ${service}\nPreferred: ${preferredDate} at ${preferredTime}\nLocation: ${location}\nNotes: ${notes || 'None'}`
            }, error => resolve(!error)))
            : sendViaFormSubmit(mailData);

        notifyOwner.then(emailSent => {
            res.status(201).json({ success: true, bookingId, emailSent, message: emailSent ? 'Booking request sent' : 'Booking saved; email delivery needs configuration' });
        }).catch(() => {
            res.status(201).json({ success: true, bookingId, emailSent: false, message: 'Booking saved; email delivery needs configuration' });
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
    if (!process.env.ADMIN_API_KEY || req.get('x-admin-key') !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }
    db.all(`SELECT * FROM appointments ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ bookings: rows });
    });
});

app.patch('/api/bookings/:id', (req, res) => {
    if (!process.env.ADMIN_API_KEY || req.get('x-admin-key') !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }
    const allowedStatuses = ['new', 'confirmed', 'completed', 'cancelled'];
    const { status } = req.body;
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid booking status' });
    db.run(`UPDATE appointments SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (!this.changes) return res.status(404).json({ error: 'Booking not found' });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Coast Turtle's IT Land Server running on http://localhost:${PORT}`);
});
