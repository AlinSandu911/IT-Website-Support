// Private dashboard: view requests and reviews, update statuses, export, and test email delivery.

document.addEventListener('DOMContentLoaded', () => {
    const keyInput = document.getElementById('admin-key');
    const status = document.getElementById('admin-status');
    const filter = document.getElementById('request-filter');
    let requests = [];
    let reviews = [];

    const adminFetch = (url, options = {}) => fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'x-admin-key': keyInput.value, ...options.headers }
    });

    document.getElementById('load-data').addEventListener('click', async event => {
        if (!keyInput.value) {
            status.textContent = 'Enter the admin key first.';
            return;
        }
        event.target.disabled = true;
        status.textContent = 'Loading...';
        try {
            const [requestsResponse, reviewsResponse] = await Promise.all([adminFetch('/api/requests'), adminFetch('/api/admin/reviews')]);
            const failed = [requestsResponse, reviewsResponse].find(response => !response.ok);
            if (failed) throw new Error(await apiErrorMessage(failed));
            requests = (await requestsResponse.json()).requests || [];
            reviews = (await reviewsResponse.json()).reviews || [];
            renderRequests();
            renderReviews();
            const newRequests = requests.filter(item => item.status === 'new').length;
            const pendingReviews = reviews.filter(item => !item.published).length;
            status.textContent = `Loaded ${requests.length} requests (${newRequests} new) and ${reviews.length} reviews (${pendingReviews} awaiting approval).`;
        } catch (error) {
            status.textContent = error.message;
        } finally {
            event.target.disabled = false;
        }
    });

    filter.addEventListener('change', renderRequests);

    document.getElementById('export-data').addEventListener('click', () => {
        if (!requests.length) {
            status.textContent = 'Load the requests first.';
            return;
        }
        const columns = ['id', 'created_at', 'status', 'name', 'phone', 'email', 'service', 'services', 'estimate', 'location', 'preferred_date', 'preferred_time', 'message'];
        const rows = [columns, ...requests.map(item => columns.map(column => item[column]))];
        const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = 'coast-turtle-requests.csv';
        link.click();
    });

    document.getElementById('test-email').addEventListener('click', async event => {
        if (!keyInput.value) {
            status.textContent = 'Enter the admin key first.';
            return;
        }
        event.target.disabled = true;
        status.textContent = 'Sending test email...';
        try {
            const response = await adminFetch('/api/admin/test-email', { method: 'POST' });
            if (!response.ok) throw new Error(await apiErrorMessage(response));
            status.textContent = describeEmailTest(await response.json());
        } catch (error) {
            status.textContent = error.message;
        } finally {
            event.target.disabled = false;
        }
    });

    function renderRequests() {
        const shown = requests.filter(item => filter.value === 'all' || item.status === filter.value);
        document.getElementById('requests-list').innerHTML = shown.length ? shown.map(requestCard).join('') : empty('No matching requests.');
        document.querySelectorAll('[data-request-id]').forEach(select => select.addEventListener('change', updateRequestStatus));
    }

    async function updateRequestStatus(event) {
        const request = requests.find(item => String(item.id) === event.target.dataset.requestId);
        const response = await adminFetch(`/api/requests/${request.id}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) });
        if (!response.ok) {
            status.textContent = await apiErrorMessage(response);
            event.target.value = request.status;
            return;
        }
        request.status = event.target.value;
        renderRequests();
    }

    function renderReviews() {
        document.getElementById('reviews-admin-list').innerHTML = reviews.length ? reviews.map(reviewCard).join('') : empty('No reviews yet.');
        document.querySelectorAll('[data-review-id]').forEach(button => button.addEventListener('click', toggleReview));
    }

    async function toggleReview(event) {
        const review = reviews.find(item => String(item.id) === event.target.dataset.reviewId);
        const published = !review.published;
        const response = await adminFetch(`/api/reviews/${review.id}`, { method: 'PATCH', body: JSON.stringify({ published }) });
        if (!response.ok) {
            status.textContent = await apiErrorMessage(response);
            return;
        }
        review.published = published ? 1 : 0;
        renderReviews();
    }
});

function requestCard(item) {
    const preferred = [item.preferred_date, item.preferred_time].filter(Boolean).join(' · ') || 'Any time';
    const statusOptions = ['new', 'confirmed', 'completed', 'cancelled']
        .map(value => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${value[0].toUpperCase()}${value.slice(1)}</option>`)
        .join('');
    return `<article class="bg-surface border border-line rounded-xl p-4">
        <div class="flex justify-between gap-3"><h3 class="font-bold text-ink">${escapeValue(item.name)} · ${escapeValue(item.service)}</h3><span class="text-xs text-muted whitespace-nowrap">${escapeValue(item.created_at)}</span></div>
        ${item.services ? `<p class="text-xs text-accent-light mt-1">Estimator: ${escapeValue(item.services)}${item.estimate ? ` · ${escapeValue(item.estimate)}` : ''}</p>` : ''}
        <p class="text-sm text-muted mt-2">${escapeValue(item.location)} · ${escapeValue(preferred)}</p>
        <p class="text-sm text-ink mt-2 whitespace-pre-line">${escapeValue(item.message)}</p>
        <p class="text-sm text-accent-light mt-2"><a href="tel:${escapeValue(item.phone)}">${escapeValue(item.phone)}</a> · <a href="mailto:${escapeValue(item.email)}">${escapeValue(item.email)}</a></p>
        <select data-request-id="${escapeValue(item.id)}" class="field-input mt-3" aria-label="Status for request from ${escapeValue(item.name)}">${statusOptions}</select>
    </article>`;
}

function reviewCard(item) {
    const label = item.published ? 'Published' : 'Awaiting approval';
    const action = item.published ? 'Hide' : 'Publish';
    return `<article class="bg-surface border border-line rounded-xl p-4">
        <div class="flex justify-between gap-3"><h3 class="font-bold text-ink">${escapeValue(item.name)} · ${escapeValue(item.rating)}/5</h3><span class="text-xs text-muted">${label}</span></div>
        <p class="text-sm text-muted mt-2">${escapeValue(item.review)}</p>
        <p class="text-xs text-muted mt-2">${escapeValue(item.created_at)}</p>
        <button data-review-id="${escapeValue(item.id)}" class="mt-3 border border-accent-border text-accent-light font-bold px-4 py-2 rounded-xl">${action}</button>
    </article>`;
}

async function apiErrorMessage(response) {
    const result = await response.json().catch(() => ({}));
    return result.error || `The server is unavailable (HTTP ${response.status}). If you just changed settings in Render, wait a minute and try again.`;
}

function describeEmailTest(result) {
    const method = { resend: 'Resend', gmail: `Gmail (${result.emailUser})`, formsubmit: 'FormSubmit' }[result.mode] || result.mode;
    if (result.sent) return `Test email sent via ${method}. Check your inbox (and spam folder).`;
    let hint = '';
    if (result.mode === 'gmail' && /timeout|ETIMEDOUT|ECONNREFUSED/i.test(result.error)) {
        hint = ' The host is blocking email connections; set RESEND_API_KEY on the server to send through Resend instead.';
    } else if (result.mode === 'resend') {
        hint = ' Check RESEND_API_KEY on the server, and that the Resend account was created with antoniosandu21@gmail.com.';
    } else if (result.mode === 'formsubmit' && result.emailPassLength > 0) {
        hint = ` EMAIL_PASS is set but has ${result.emailPassLength} characters; a Gmail app password has exactly 16 letters, so Gmail isn't being used.`;
    } else if (result.mode === 'formsubmit') {
        hint = ' EMAIL_PASS is not set on the server, so FormSubmit is being used instead of Gmail.';
    }
    return `Test email failed via ${method}: ${result.error}.${hint}`;
}

function empty(message) {
    return `<p class="text-muted text-sm">${message}</p>`;
}

function escapeValue(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
