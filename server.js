// Node.js Express server for Coast Turtle's IT Land
// Run with: npm install && npm start

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware. The site and API share one origin, so no CORS headers are sent:
// other websites can't submit forms here from a visitor's browser.
app.set('trust proxy', 1); // Render sits behind a proxy; needed for the real visitor IP
app.use(express.json());

// The old booking page now lives on the Contact page
app.get('/booking.html', (req, res) => res.redirect(301, '/contact.html#request'));

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

// Spaces around the key are ignored on both sides (easy to pick up when copying)
const adminKey = (process.env.ADMIN_API_KEY || '').trim();

function isAdmin(req) {
    return Boolean(adminKey) && (req.get('x-admin-key') || '').trim() === adminKey;
}

function denyAdmin(res) {
    return adminKey
        ? res.status(401).json({ error: 'Admin key not recognised. Check it matches ADMIN_API_KEY in Render > Environment.' })
        : res.status(503).json({ error: 'ADMIN_API_KEY is not set on the server. Add it in Render > Environment.' });
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

// 1. Database: Turso (online, survives redeploys) when TURSO_DATABASE_URL is set,
//    otherwise a local SQLite file (fine for development; wiped on each Render deploy).
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');
const tursoUrl = (process.env.TURSO_DATABASE_URL || '').trim();
if (!tursoUrl) fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = createClient(tursoUrl
    ? { url: tursoUrl, authToken: (process.env.TURSO_AUTH_TOKEN || '').trim() }
    : { url: `file:${databasePath}` });
const databaseLabel = tursoUrl ? `Turso (${new URL(tursoUrl.replace(/^libsql:/, 'https:')).hostname})` : `local file (${databasePath})`;

// Runs a query and returns plain row objects
async function query(sql, args = []) {
    const result = await db.execute({ sql, args });
    return result.rows.map(row => Object.fromEntries(result.columns.map((column, i) => [column, row[i]])));
}

async function run(sql, args = []) {
    const result = await db.execute({ sql, args });
    return { id: result.lastInsertRowid === undefined ? null : Number(result.lastInsertRowid), changes: result.rowsAffected };
}

async function setUpDatabase() {
    await db.batch([
        `CREATE TABLE IF NOT EXISTS service_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            service TEXT NOT NULL,
            location TEXT NOT NULL,
            preferred_date TEXT,
            preferred_time TEXT,
            services TEXT,
            estimate TEXT,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS customer_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            review TEXT NOT NULL,
            photos TEXT,
            published INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS page_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ], 'write');
}

// Wraps async route handlers so database errors become a 500 instead of crashing the server
const route = handler => (req, res) => handler(req, res).catch(error => {
    console.error(`${req.method} ${req.path} failed:`, error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong on the server' });
});

// 2. Email notifications to the owner, using the first method that is configured:
//    - Resend (RESEND_API_KEY): sends over HTTPS, so it works on hosts that block email ports (like Render)
//    - Gmail (16-character app password in EMAIL_PASS): needs outgoing SMTP, which some hosts block
//    - FormSubmit: only delivers once its one-time activation email has been confirmed
const OWNER_EMAIL = 'antoniosandu21@gmail.com';
const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
const resendFrom = process.env.RESEND_FROM || "Coast Turtle's IT Land <onboarding@resend.dev>";
const gmailUser = (process.env.EMAIL_USER || OWNER_EMAIL).trim();
const gmailPassword = (process.env.EMAIL_PASS || '').replace(/\s/g, '');
const emailMode = resendApiKey ? 'resend'
    : /^[a-zA-Z0-9]{16}$/.test(gmailPassword) ? 'gmail'
    : 'formsubmit';
const transporter = emailMode === 'gmail'
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPassword },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
    })
    : null;

// fields: [label, value] pairs shown in the email. replyTo: the customer's address, so
// pressing Reply in your inbox answers them directly. Resolves to { sent, error }.
async function notifyOwner(subject, fields, replyTo) {
    const text = fields.map(([label, value]) => `${label}: ${value || 'Not specified'}`).join('\n');
    const html = `<h2>${escapeHtml(subject)}</h2>` + fields
        .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || 'Not specified')}</p>`)
        .join('');
    const validReplyTo = typeof replyTo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) ? replyTo : undefined;

    try {
        if (emailMode === 'resend') {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: resendFrom, to: [OWNER_EMAIL], subject, text, html, ...(validReplyTo && { reply_to: validReplyTo }) }),
                signal: AbortSignal.timeout(15000)
            });
            if (response.ok) return { sent: true };
            const result = await response.json().catch(() => ({}));
            throw new Error(result.message || `Resend responded with HTTP ${response.status}`);
        }

        if (emailMode === 'gmail') {
            await transporter.sendMail({ from: `"Coast Turtle's IT Land Website" <${gmailUser}>`, to: OWNER_EMAIL, replyTo: validReplyTo, subject, text, html });
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

// 3. Repair and quote requests (the Contact page form)
const REQUEST_STATUSES = ['new', 'confirmed', 'completed', 'cancelled'];
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

app.post('/api/requests', limitFormSubmissions, route(async (req, res) => {
    const request = {
        name: text(req.body.name, 100),
        phone: text(req.body.phone, 40),
        email: text(req.body.email, 200),
        service: text(req.body.service, 100),
        location: text(req.body.location, 60),
        preferredDate: text(req.body.preferredDate, 20),
        preferredTime: text(req.body.preferredTime, 40),
        services: text(req.body.services, 500),
        estimate: text(req.body.estimate, 20),
        message: text(req.body.message, 3000)
    };
    if (!request.name || !request.phone || !request.email || !request.service || !request.location || !request.message) {
        return res.status(400).json({ error: 'Name, phone, email, service, location and a description are required' });
    }

    const { id } = await run(
        `INSERT INTO service_requests (name, phone, email, service, location, preferred_date, preferred_time, services, estimate, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [request.name, request.phone, request.email, request.service, request.location,
            request.preferredDate || null, request.preferredTime || null, request.services || null, request.estimate || null, request.message]
    );

    const preferred = [request.preferredDate, request.preferredTime].filter(Boolean).join(', ') || 'Any time';
    const { sent } = await notifyOwner(`New request from ${request.name}: ${request.service}`, [
        ['Name', request.name], ['Phone', request.phone], ['Email', request.email],
        ['Service', request.service], ['From the price estimator', request.services], ['Estimate', request.estimate],
        ['Where', request.location], ['Preferred', preferred], ['Message', request.message]
    ], request.email);

    res.status(sent ? 201 : 202).json({ success: true, requestId: id, emailSent: sent });
}));

app.get('/api/requests', route(async (req, res) => {
    if (!isAdmin(req)) return denyAdmin(res);
    res.json({ requests: await query(`SELECT * FROM service_requests ORDER BY created_at DESC, id DESC`) });
}));

app.patch('/api/requests/:id', route(async (req, res) => {
    if (!isAdmin(req)) return denyAdmin(res);
    if (!REQUEST_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    const { changes } = await run(`UPDATE service_requests SET status = ? WHERE id = ?`, [req.body.status, Number(req.params.id)]);
    if (!changes) return res.status(404).json({ error: 'Request not found' });
    res.json({ success: true });
}));

// Admin-only: send a test notification and report exactly what happened
app.post('/api/admin/test-email', route(async (req, res) => {
    if (!isAdmin(req)) return denyAdmin(res);
    const result = await notifyOwner('Test email from your website', [
        ['Sent at', new Date().toISOString()], ['Delivery method', emailMode]
    ]);
    res.json({
        ...result,
        mode: emailMode,
        emailUser: emailMode === 'gmail' ? gmailUser : null,
        emailPassLength: gmailPassword.length
    });
}));

// 4. Customer reviews are held for approval in admin.html before appearing on the site.
// Photos are not accepted here; customers can send them by email instead.
app.post('/api/reviews', limitFormSubmissions, route(async (req, res) => {
    const name = text(req.body.name, 100);
    const review = text(req.body.review, 700);
    const rating = Number(req.body.rating);
    if (!name || !review || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Name, review, and a rating from 1 to 5 are required' });
    }
    const { id } = await run(`INSERT INTO customer_reviews (name, rating, review, photos, published) VALUES (?, ?, ?, '[]', 0)`, [name, rating, review]);
    res.status(201).json({ success: true, reviewId: id });
}));

app.get('/api/reviews', route(async (req, res) => {
    res.json({ reviews: await query(`SELECT id, name, rating, review, created_at FROM customer_reviews WHERE published = 1 ORDER BY created_at DESC, id DESC`) });
}));

app.get('/api/admin/reviews', route(async (req, res) => {
    if (!isAdmin(req)) return denyAdmin(res);
    res.json({ reviews: await query(`SELECT id, name, rating, review, published, created_at FROM customer_reviews ORDER BY published ASC, created_at DESC, id DESC`) });
}));

app.patch('/api/reviews/:id', route(async (req, res) => {
    if (!isAdmin(req)) return denyAdmin(res);
    if (typeof req.body.published !== 'boolean') return res.status(400).json({ error: 'published must be true or false' });
    const { changes } = await run(`UPDATE customer_reviews SET published = ? WHERE id = ?`, [req.body.published ? 1 : 0, Number(req.params.id)]);
    if (!changes) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true });
}));

// Public health check: is the server up, and which kind of database is it using?
app.get('/api/health', (req, res) => {
    res.json({ ok: true, database: tursoUrl ? 'turso' : 'local file' });
});

// 5. Anonymous page-view counter (page path only)
app.post('/api/analytics', route(async (req, res) => {
    const pathName = typeof req.body.path === 'string' ? req.body.path.slice(0, 200) : '/';
    await run(`INSERT INTO page_events (path) VALUES (?)`, [pathName]);
    res.sendStatus(204);
}));

setUpDatabase()
    .then(() => {
        console.log(`Database: ${databaseLabel}`);
        console.log(`Email notifications: ${emailMode}`);
        app.listen(PORT, '0.0.0.0', () => console.log(`Coast Turtle's IT Land server running on http://localhost:${PORT}`));
    })
    .catch(error => {
        console.error(`Could not open the database (${databaseLabel}):`, error.message);
        process.exit(1);
    });
