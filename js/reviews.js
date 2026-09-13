const REVIEW_STORAGE_KEY = 'antonio_customer_reviews';

function loadReviews() {
    try {
        return JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function renderReviews() {
    const list = document.getElementById('reviews-list');
    const empty = document.getElementById('reviews-empty');
    if (!list || !empty) return;

    const reviews = loadReviews().filter(review => review.published !== false);
    empty.classList.toggle('hidden', reviews.length > 0);
    list.innerHTML = reviews.map(review => {
        const stars = '★'.repeat(Number(review.rating)) + '☆'.repeat(5 - Number(review.rating));
        const photos = (review.photos || []).map(photo => `<img src="${photo}" alt="Customer setup photo" class="w-full aspect-square object-cover rounded-lg">`).join('');
        return `
            <article class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div class="text-amber-500 tracking-wider" aria-label="${review.rating} out of 5 stars">${stars}</div>
                <p class="text-slate-700 mt-4 leading-relaxed">${escapeHtml(review.review)}</p>
                ${photos ? `<div class="grid grid-cols-3 gap-2 mt-5">${photos}</div>` : ''}
                <div class="border-t border-slate-100 mt-5 pt-4 text-sm font-semibold text-slate-900">${escapeHtml(review.name)}</div>
            </article>`;
    }).join('');
}

function renderHomeReviews() {
    const list = document.getElementById('home-reviews-list');
    if (!list) return;

    const reviews = loadReviews().filter(review => review.published !== false);
    if (!reviews.length) return;

    list.innerHTML = reviews.slice(-6).reverse().map(review => {
        const stars = '★'.repeat(Number(review.rating)) + '☆'.repeat(5 - Number(review.rating));
        return `
            <article class="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div><div class="text-amber-500 tracking-wider mb-4">${stars}</div><p class="text-slate-700 text-sm italic">"${escapeHtml(review.review)}"</p></div>
                <div class="text-sm font-bold text-slate-900 mt-6">${escapeHtml(review.name)}</div>
            </article>`;
    }).join('');
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

document.addEventListener('DOMContentLoaded', () => {
    renderReviews();
    renderHomeReviews();
    syncReviewsFromDatabase();

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
        const review = {
            name: formData.get('name'),
            rating: formData.get('rating'),
            review: formData.get('review'),
            published: true,
            submittedAt: new Date().toISOString(),
            photos: []
        };

        // Keep a local copy so the submission is not lost on a static site.
        const pending = loadReviews();
        pending.push(review);
        localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(pending));
        renderReviews();
        renderHomeReviews();

        const databasePayload = {
            name: review.name,
            rating: Number(review.rating),
            review: review.review,
            photos: []
        };

        fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(databasePayload)
        }).catch(() => {/* Static hosting uses local storage and email fallback. */});

        button.disabled = true;
        button.textContent = 'Sending review...';
        formData.append('access_key', '55dfd813-f9ec-45ec-90d5-b9f1d05aa857');
        formData.append('subject', `New customer review from ${review.name}`);
        formData.append('from_name', "Coast Turtle's IT Land Reviews");
        formData.append('to_email', 'antoniosandu21@gmail.com');
        formData.append('approval_status', 'Pending approval');

        try {
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Review email failed');
            showToast('Thank you. Your review has been sent for approval.');
            form.reset();
            preview.innerHTML = '';
        } catch (error) {
            showToast('Your review was saved locally. Please also email the photos if needed.');
        } finally {
            button.disabled = false;
            button.textContent = 'Submit review';
        }
    });
});

async function syncReviewsFromDatabase() {
    try {
        const response = await fetch('/api/reviews');
        if (!response.ok) return;
        const data = await response.json();
        const existing = loadReviews();
        const databaseReviews = (data.reviews || []).map(review => ({ ...review, published: true }));
        const merged = [...databaseReviews, ...existing].filter((review, index, all) => !review.id || all.findIndex(item => item.id === review.id) === index);
        localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(merged));
        renderReviews();
        renderHomeReviews();
    } catch {
        // The localStorage fallback remains available on static hosting.
    }
}
