# Deploying Coast Turtle's IT Land Website

## Local development

1. Install Node.js 22 or newer.
2. In this folder run:

   ```powershell
   npm install
   npm start
   ```

3. Open `http://localhost:3000`.

The Node server serves the website, saves quotes and reviews to `database.db`, and exposes the API. The database file is created automatically.

## Styling (Tailwind CSS)

The site's stylesheet `css/site.css` is generated from `src/styles.css` and `tailwind.config.js`, which holds the black & green colour theme (`surface`, `ink`, `muted`, `accent`, ...). After adding or changing classes in any page or script, rebuild it and commit the result:

```powershell
npm run build:css
```

`css/site.css` is committed to the repository, so the host doesn't need a build step.

Do not test quote delivery by double-clicking `contact.html`; that uses a `file://` URL and cannot reach the Node API. Use `http://localhost:3000/contact.html` instead.

## Email setup

1. Copy `.env.example` to `.env`.
2. Create a Google app password for `antoniosandu21@gmail.com`.
3. Put that app password in `EMAIL_PASS`.
4. Set a long random value for `ADMIN_API_KEY`.

The contact form now reports SMTP delivery honestly. If SMTP is unavailable, it opens a prepared email addressed to `antoniosandu21@gmail.com` rather than showing a false success message.

The new `booking.html` page saves preferred appointment date, time, service, and location to the database. Open `admin.html` and enter `ADMIN_API_KEY` to view quote and booking records. Keep that page private and never share the admin key.

`privacy.html` and `terms.html` are starter business-policy pages. Review them with a solicitor or adjust them to match your final business setup before launch.

Never commit `.env` or a production database containing customer information.

The website also sends forms through Web3Forms as a browser fallback. Replace the demo `access_key` values in `js/main.js` and `js/reviews.js` with your own Web3Forms key before launch.

## Public hosting

Use a Node-compatible host such as Render, Railway, Fly.io, or a VPS. Create a Web Service from this folder with:

- Build command: `npm install`
- Start command: `npm start`
- Node version: 22

Add the variables from `.env` in the host's environment-variable settings. The site and API should then use the same public URL, so `/api/reviews` and `/api/quotes` work without extra frontend configuration.

Attach a custom domain in the host dashboard, enable the automatic HTTPS certificate, and set the canonical public URL in your Google Business Profile. Create the Google Business Profile separately and complete address/service-area verification; that step cannot be automated from the website.

## SQLite persistence

SQLite is appropriate for a small community service, but the host must provide persistent disk storage. Render requires a paid persistent disk mounted beside the project; Railway requires a persistent volume. Without a volume, `database.db` can be reset during redeploys.

For higher traffic or multiple administrators, move the two tables to managed PostgreSQL such as Supabase, Neon, or the host's PostgreSQL service. Keep the same API contract so the frontend does not need to change.

The lightweight analytics endpoint stores anonymous page paths in SQLite. For full conversion tracking, add a Google Analytics 4 measurement ID after creating your property; do not add personal customer data to analytics events.

## Review flow

Submitted reviews are saved to the database as unpublished and emailed to Antonio (with any photos) via Web3Forms. They only appear on the site after being published from `admin.html`. Published reviews are shown on `reviews.html`, and the Home page reviews row appears once at least one review is published.

## Security notes

- Only website files (`*.html`, `css/`, `js/`, `images/`) are served publicly; `server.js` blocks everything else, including `database.db`. Put any new public files in those folders.
- Form endpoints are limited to 10 submissions per visitor per 15 minutes.