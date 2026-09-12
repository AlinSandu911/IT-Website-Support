document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('load-data');
    const keyInput = document.getElementById('admin-key');
    const status = document.getElementById('admin-status');
    const filter = document.getElementById('booking-filter');
    let loadedBookings = [];
    let loadedQuotes = [];

    button.addEventListener('click', async () => {
        const key = keyInput.value;
        if (!key) return;
        button.disabled = true;
        status.textContent = 'Loading...';
        try {
            const headers = { 'x-admin-key': key };
            const [bookingsResponse, quotesResponse] = await Promise.all([
                fetch('/api/bookings', { headers }),
                fetch('/api/quotes', { headers })
            ]);
            if (!bookingsResponse.ok || !quotesResponse.ok) throw new Error('Invalid admin key or unavailable API');
            loadedBookings = (await bookingsResponse.json()).bookings || [];
            loadedQuotes = (await quotesResponse.json()).quotes || [];
            renderBookings();
            document.getElementById('quotes-list').innerHTML = loadedQuotes.length ? loadedQuotes.map(item => card(`${item.name} · ${item.services || 'General support'}`, item.message, item.phone, item.email, item.estimate)).join('') : empty('No quotes yet.');
            status.textContent = `Loaded ${loadedBookings.length} bookings and ${loadedQuotes.length} quotes.`;
        } catch (error) {
            status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    filter.addEventListener('change', renderBookings);
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
});

function card(title, detail, phone, email, extra) {
    return `<article class="bg-white border border-slate-200 rounded-xl p-4"><h3 class="font-bold text-slate-900">${escapeValue(title)}</h3><p class="text-sm text-slate-600 mt-2">${escapeValue(detail || '')}</p><p class="text-sm text-green-600 mt-2">${escapeValue(phone)} · ${escapeValue(email)}</p><p class="text-xs text-slate-500 mt-2">${escapeValue(extra || '')}</p></article>`;
}

function bookingCard(item) {
    return `<article class="bg-white border border-slate-200 rounded-xl p-4"><h3 class="font-bold text-slate-900">${escapeValue(item.name)} · ${escapeValue(item.service)}</h3><p class="text-sm text-slate-600 mt-2">${escapeValue(item.preferred_date)} · ${escapeValue(item.preferred_time)} · ${escapeValue(item.location)}</p><p class="text-sm text-green-600 mt-2">${escapeValue(item.phone)} · ${escapeValue(item.email)}</p><select data-booking-id="${item.id}" class="field-input mt-3"><option ${item.status === 'new' ? 'selected' : ''} value="new">New</option><option ${item.status === 'confirmed' ? 'selected' : ''} value="confirmed">Confirmed</option><option ${item.status === 'completed' ? 'selected' : ''} value="completed">Completed</option><option ${item.status === 'cancelled' ? 'selected' : ''} value="cancelled">Cancelled</option></select></article>`;
}

function empty(message) {
    return `<p class="text-slate-500 text-sm">${message}</p>`;
}

function escapeValue(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
