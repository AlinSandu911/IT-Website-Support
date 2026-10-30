// Reviews are stored on the server and only appear once approved in admin.html.

function starText(rating) {
    const value = Math.min(5, Math.max(1, Math.round(Number(rating)) || 1));
    return '★'.repeat(value) + '☆'.repeat(5 - value);
}

function renderReviews(reviews) {
    const list = document.getElementById('reviews-list');
    const empty = document.getElementById('reviews-empty');
    if (!list || !empty) return;

    empty.classList.toggle('hidden', reviews.length > 0);
    list.innerHTML = reviews.map(review => `
            <article class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div class="text-amber-500 tracking-wider" aria-label="${escapeHtml(review.rating)} out of 5 stars">${starText(review.rating)}</div>
                <p class="text-slate-700 mt-4 leading-relaxed">${escapeHtml(review.review)}</p>
                <div class="border-t border-slate-100 mt-5 pt-4 text-sm font-semibold text-slate-900">${escapeHtml(review.name)}</div>
            </article>`).join('');
}

function renderHomeReviews(reviews) {
    const list = document.getElementById('home-reviews-list');
    if (!list || !reviews.length) return;

    document.getElementById('home-reviews')?.classList.remove('hidden');
    list.innerHTML = reviews.slice(0, 6).map(review => `
            <article class="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div><div class="text-amber-500 tracking-wider mb-4" aria-label="${escapeHtml(review.rating)} out of 5 stars">${starText(review.rating)}</div><p class="text-slate-700 text-sm italic">"${escapeHtml(review.review)}"</p></div>
                <div class="text-sm font-bold text-slate-900 mt-6">${escapeHtml(review.name)}</div>
            </article>`).join('');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

async function loadPublishedReviews() {
    try {
        const response = await fetch('/api/reviews');
        if (!response.ok) return;
        const data = await response.json();
        const reviews = data.reviews || [];
        renderReviews(reviews);
        renderHomeReviews(reviews);
    } catch {
        // Leave the "no reviews yet" message in place if the server is unreachable.
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Older versions kept copies of reviews in the browser; clear them out.
    try { localStorage.removeItem('antonio_customer_reviews'); } catch { /* storage unavailable */ }

    loadPublishedReviews();

    const imageInput = document.getElementById('review-images');
    const preview = document.getElementById('review-image-preview');
    if (imageInput && preview) {
        imageInput.addEventListener('change', () => {
            preview.innerHTML = '';
            [...imageInput.files].slice(0, 6).forEach(file => {
                if (!file.type.startsWith('image/')) return;
                const image = document.createElement('img');
                image.className = 'w-full aspect-square object-cover rounded-lg border border-slate-200';
                image.alt = 'Selected review photo preview';
                image.src = URL.createObjectURL(file);
                preview.appendChild(image);
            });
        });
    }

    const form = document.getElementById('review-form');
    if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const name = formData.get('name');

        button.disabled = true;
        button.textContent = 'Sending review...';

        let saved = false;
        try {
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, rating: Number(formData.get('rating')), review: formData.get('review') })
            });
            saved = response.ok;
        } catch {
            saved = false;
        }

        // Email notification (includes any attached photos) so new reviews are noticed.
        formData.append('access_key', '55dfd813-f9ec-45ec-90d5-b9f1d05aa857');
        formData.append('subject', `New customer review from ${name}`);
        formData.append('from_name', "Coast Turtle's IT Land Reviews");
        formData.append('approval_status', 'Pending approval');
        let emailed = false;
        try {
            const response = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData });
            emailed = response.ok;
        } catch {
            emailed = false;
        }

        if (saved || emailed) {
            showToast('Thank you! Your review will appear once it has been approved.');
            form.reset();
            if (preview) preview.innerHTML = '';
        } else {
            showToast('Sorry, your review could not be sent. Please try again or email antoniosandu21@gmail.com.');
        }
        button.disabled = false;
        button.textContent = 'Submit review';
    });
});
