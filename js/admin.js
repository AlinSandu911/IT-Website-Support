document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('load-data');
    const keyInput = document.getElementById('admin-key');
    const status = document.getElementById('admin-status');
    const filter = document.getElementById('booking-filter');
    let loadedBookings = [];
    let loadedQuotes = [];
    let loadedReviews = [];

    button.addEventListener('click', async () => {
        const key = keyInput.value;
        if (!key) return;
        button.disabled = true;
        status.textContent = 'Loading...';
        try {
            const headers = { 'x-admin-key': key };
            const [bookingsResponse, quotesResponse, reviewsResponse] = await Promise.all([
                fetch('/api/bookings', { headers }),
                fetch('/api/quotes', { headers }),
                fetch('/api/admin/reviews', { headers })
            ]);
            if (!bookingsResponse.ok || !quotesResponse.ok || !reviewsResponse.ok) throw new Error('Invalid admin key or unavailable API');
            loadedBookings = (await bookingsResponse.json()).bookings || [];
            loadedQuotes = (await quotesResponse.json()).quotes || [];
            loadedReviews = (await reviewsResponse.json()).reviews || [];
            renderBookings();
            renderReviews();
            document.getElementById('quotes-list').innerHTML = loadedQuotes.length ? loadedQuotes.map(item => card(`${item.name} · ${item.services || 'General support'}`, item.message, item.phone, item.email, item.estimate)).join('') : empty('No quotes yet.');
            const pending = loadedReviews.filter(item => !item.published).length;
            status.textContent = `Loaded ${loadedBookings.length} bookings, ${loadedQuotes.length} quotes and ${loadedReviews.length} reviews (${pending} awaiting approval).`;
        } catch (error) {
            status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    filter.addEventListener('change', renderBookings);

    document.getElementById('test-email').addEventListener('click', async event => {
        const key = keyInput.value;
        if (!key) {
            status.textContent = 'Enter the admin key first.';
            return;
        }
        event.target.disabled = true;
        status.textContent = 'Sending test email...';
        try {
            const response = await fetch('/api/admin/test-email', { method: 'POST', headers: { 'x-admin-key': key } });
            if (!response.ok) throw new Error('Invalid admin key or unavailable API');
            status.textContent = describeEmailTest(await response.json());
        } catch (error) {
            status.textContent = error.message;
        } finally {
            event.target.disabled = false;
        }
    });
    document.getElementById('export-data').addEventListener('click', () => {
        if (!loadedBookings.length && !loadedQuotes.length) return;
        const rows = [['Type', 'Name', 'Contact', 'Details', 'Status']];
        loadedBookings.forEach(item => rows.push(['Booking', item.name, `${item.phone} ${item.email}`, `${item.service} - ${item.preferred_date} ${item.preferred_time}`, item.status]));
        loadedQuotes.forEach(item => rows.push(['Quote', item.name, `${item.phone} ${item.email}`, item.services || 'General support', 'new']));
        const csv = rows.map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = 'antonios-it-requests.csv';
        link.click();
    });

    function renderBookings() {
        const selected = filter.value;
        const bookings = loadedBookings.filter(item => selected === 'all' || item.status === selected);
        document.getElementById('bookings-list').innerHTML = bookings.length ? bookings.map(item => bookingCard(item)).join('') : empty('No matching bookings.');
        document.querySelectorAll('[data-booking-id]').forEach(select => select.addEventListener('change', updateStatus));
    }

    async function updateStatus(event) {
        const response = await fetch(`/api/bookings/${event.target.dataset.bookingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': keyInput.value }, body: JSON.stringify({ status: event.target.value }) });
        if (!response.ok) status.textContent = 'Could not update booking status.';
    }

    function renderReviews() {
        document.getElementById('reviews-admin-list').innerHTML = loadedReviews.length ? loadedReviews.map(item => reviewCard(item)).join('') : empty('No reviews yet.');
        document.querySelectorAll('[data-review-id]').forEach(toggle => toggle.addEventListener('click', toggleReview));
    }

    async function toggleReview(event) {
        const review = loadedReviews.find(item => String(item.id) === event.target.dataset.reviewId);
        if (!review) return;
        const published = !review.published;
        const response = await fetch(`/api/reviews/${review.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': keyInput.value }, body: JSON.stringify({ published }) });
        if (!response.ok) {
            status.textContent = 'Could not update review.';
            return;
        }
        review.published = published ? 1 : 0;
        renderReviews();
    }
});

function describeEmailTest(result) {
    const method = result.mode === 'gmail' ? `Gmail (${result.emailUser})` : 'FormSubmit';
    if (result.sent) return `Test email sent via ${method}. Check your inbox (and spam folder).`;
    let hint = '';
    if (result.mode === 'formsubmit' && result.emailPassLength > 0) {
        hint = ` EMAIL_PASS is set but has ${result.emailPassLength} characters; a Gmail app password has exactly 16 letters, so Gmail isn't being used.`;
    } else if (result.mode === 'formsubmit') {
        hint = ' EMAIL_PASS is not set on the server, so FormSubmit is being used instead of Gmail.';
    }
    return `Test email failed via ${method}: ${result.error}.${hint}`;
}

function reviewCard(item) {
    const label = item.published ? 'Published' : 'Awaiting approval';
    const action = item.published ? 'Hide' : 'Publish';
    return `<article class="bg-surface border border-line rounded-xl p-4"><div class="flex justify-between gap-3"><h3 class="font-bold text-ink">${escapeValue(item.name)} · ${escapeValue(item.rating)}/5</h3><span class="text-xs text-muted">${label}</span></div><p class="text-sm text-muted mt-2">${escapeValue(item.review)}</p><p class="text-xs text-muted mt-2">${escapeValue(item.created_at)}</p><button data-review-id="${escapeValue(item.id)}" class="mt-3 border border-accent-border text-accent-light font-bold px-4 py-2 rounded-xl">${action}</button></article>`;
}

function card(title, detail, phone, email, extra) {
    return `<article class="bg-surface border border-line rounded-xl p-4"><h3 class="font-bold text-ink">${escapeValue(title)}</h3><p class="text-sm text-muted mt-2">${escapeValue(detail || '')}</p><p class="text-sm text-accent-light mt-2">${escapeValue(phone)} · ${escapeValue(email)}</p><p class="text-xs text-muted mt-2">${escapeValue(extra || '')}</p></article>`;
}

function bookingCard(item) {
    return `<article class="bg-surface border border-line rounded-xl p-4"><h3 class="font-bold text-ink">${escapeValue(item.name)} · ${escapeValue(item.service)}</h3><p class="text-sm text-muted mt-2">${escapeValue(item.preferred_date)} · ${escapeValue(item.preferred_time)} · ${escapeValue(item.location)}</p><p class="text-sm text-accent-light mt-2">${escapeValue(item.phone)} · ${escapeValue(item.email)}</p><select data-booking-id="${item.id}" class="field-input mt-3"><option ${item.status === 'new' ? 'selected' : ''} value="new">New</option><option ${item.status === 'confirmed' ? 'selected' : ''} value="confirmed">Confirmed</option><option ${item.status === 'completed' ? 'selected' : ''} value="completed">Completed</option><option ${item.status === 'cancelled' ? 'selected' : ''} value="cancelled">Cancelled</option></select></article>`;
}

function empty(message) {
    return `<p class="text-muted text-sm">${message}</p>`;
}

function escapeValue(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
