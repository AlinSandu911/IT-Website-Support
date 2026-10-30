// Main JavaScript for Coast Turtle's IT Land

const OWNER_EMAIL = 'antoniosandu21@gmail.com';
const WEB3FORMS_ACCESS_KEY = '55dfd813-f9ec-45ec-90d5-b9f1d05aa857';

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    highlightActiveNavLink();
    initAccessibilityToolbar();
    initContactForm();
    recordPageView();
});

function initMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!menuBtn || !mobileMenu) return;

    menuBtn.addEventListener('click', () => {
        const isOpen = !mobileMenu.classList.toggle('hidden');
        menuBtn.setAttribute('aria-expanded', String(isOpen));
        menuBtn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });
}

function highlightActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        const isCurrent = link.getAttribute('href') === currentPage;
        link.classList.toggle('active', isCurrent);
        if (isCurrent) link.setAttribute('aria-current', 'page');
    });
}

// Anonymous page-view count (page path only, no cookies or personal data)
function recordPageView() {
    if (window.location.protocol === 'file:' || !navigator.sendBeacon) return;
    navigator.sendBeacon('/api/analytics', new Blob([JSON.stringify({ path: window.location.pathname })], { type: 'application/json' }));
}

// Contact form: the server saves the request (visible in admin.html) and emails it.
// Web3Forms is only used if the server can't be reached; an email draft is the last resort.
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    prefillFromEstimator(form);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalLabel = submitBtn.innerHTML;
        const request = Object.fromEntries(new FormData(form));

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending request...';

        try {
            if (await deliverQuote(request)) {
                showToast("Thanks! Your request has been sent and I'll be in touch shortly.");
                form.reset();
            } else {
                openEmailDraft(request);
                showToast('Online sending is unavailable, so your email app has been opened with the request ready to send.');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
        }
    });
}

// Fill in the services and total when arriving from the pricing estimator
function prefillFromEstimator(form) {
    const params = new URLSearchParams(window.location.search);
    const services = params.get('services');
    const estimate = params.get('estimate');
    if (services) form.elements.services.value = services;
    if (estimate) form.elements.estimate.value = `£${estimate}`;
}

async function deliverQuote(request) {
    if (window.location.protocol !== 'file:') {
        try {
            const response = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });
            if (response.ok) return true;
        } catch (error) {
            console.warn('Website server unavailable, trying Web3Forms:', error);
        }
    }

    try {
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                access_key: WEB3FORMS_ACCESS_KEY,
                subject: `New IT Repair Request from ${request.name} (${request.phone})`,
                from_name: "Coast Turtle's IT Land Website",
                ...request
            })
        });
        const result = await response.json();
        return response.ok && result.success;
    } catch (error) {
        console.warn('Web3Forms unavailable:', error);
        return false;
    }
}

function openEmailDraft(request) {
    const subject = encodeURIComponent(`IT repair request from ${request.name}`);
    const body = encodeURIComponent([
        `Name: ${request.name}`,
        `Phone: ${request.phone}`,
        `Email: ${request.email}`,
        `Services: ${request.services || 'Not specified'}`,
        `Estimate: ${request.estimate || 'Not specified'}`,
        '',
        request.message
    ].join('\n'));
    window.location.href = `mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`;
}

// Readability toolbar: dyslexia-friendly font toggle, remembered in this browser
function initAccessibilityToolbar() {
    const slot = document.getElementById('ui-modes-slot');
    if (!slot) return;

    if (readSetting('mode_dyslexic') === 'true') document.body.classList.add('dyslexic-mode');

    const widget = document.createElement('div');
    widget.className = 'ui-modes-box bg-slate-800/80 backdrop-blur rounded-lg border border-slate-700 flex items-center gap-1.5 p-1.5';
    widget.innerHTML = `
        <span class="text-[10px] font-bold text-green-300 uppercase tracking-wider px-1">Readability</span>
        <button type="button" title="Toggle dyslexia-friendly font" aria-label="Dyslexia-friendly font" class="ui-mode-button">Aa</button>`;
    slot.appendChild(widget);

    const button = widget.querySelector('button');
    button.setAttribute('aria-pressed', String(document.body.classList.contains('dyslexic-mode')));
    button.addEventListener('click', () => {
        const isDyslexic = document.body.classList.toggle('dyslexic-mode');
        button.setAttribute('aria-pressed', String(isDyslexic));
        writeSetting('mode_dyslexic', String(isDyslexic));
        showToast(isDyslexic ? 'Dyslexia-friendly font enabled' : 'Standard font enabled');
    });
}

function readSetting(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function writeSetting(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function showToast(message) {
    document.getElementById('toast-notification')?.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.setAttribute('role', 'status');
    toast.className = 'fixed bottom-20 sm:bottom-5 right-5 left-5 sm:left-auto max-w-sm bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 border border-slate-700';
    toast.innerHTML = `
        <svg class="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="text-sm font-medium"></span>`;
    toast.querySelector('span').textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}
