// Main JavaScript for Coast Turtle's IT Land

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile menu toggle
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // 2. Highlight active nav link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    document.querySelectorAll('nav, #mobile-menu').forEach(menu => {
        if (!menu.querySelector('a[href="booking.html"]')) {
            const bookingLink = document.createElement('a');
            bookingLink.href = 'booking.html';
            bookingLink.textContent = 'Book a Slot';
            bookingLink.className = menu.id === 'mobile-menu'
                ? 'block px-3 py-2 rounded-md font-medium text-green-500'
                : 'nav-link text-green-500 font-bold py-2';
            menu.appendChild(bookingLink);
        }
    });

    document.querySelectorAll('footer').forEach(footer => {
        if (!footer.querySelector('a[href="privacy.html"]')) {
            const policyLinks = document.createElement('div');
            policyLinks.className = 'flex gap-4 text-xs mt-4';
            policyLinks.innerHTML = '<a href="privacy.html" class="hover:text-white">Privacy</a><a href="terms.html" class="hover:text-white">Terms</a>';
            footer.appendChild(policyLinks);
        }
    });

    if (window.location.protocol !== 'file:' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics', new Blob([JSON.stringify({ path: window.location.pathname })], { type: 'application/json' }));
    }

    if (currentPath === 'about.html') {
        renderMinimalAbout();
    }

    // 3. Accessibility & Display Modes Controller
    initAccessibilityToolbar();

    // 4. Contact Form Submission (Email sending + Database store)
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            const formData = {
                name: contactForm.querySelector('input[placeholder*="John"]') ? contactForm.querySelector('input[placeholder*="John"]').value : '',
                phone: contactForm.querySelector('input[type="tel"]').value,
                email: contactForm.querySelector('input[type="email"]').value,
                services: document.getElementById('services-field') ? document.getElementById('services-field').value : '',
                estimate: document.getElementById('estimate-field') ? document.getElementById('estimate-field').value : '',
                message: contactForm.querySelector('textarea').value,
                timestamp: new Date().toISOString()
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg> Sending Request to Antonio...
            `;

            try {
                saveToLocalDatabase(formData);

                const delivery = await deliverQuote(formData);
                if (!delivery.sent) {
                    openEmailDraft(formData);
                    showToast('Your email app has been opened with the request ready to send.');
                } else {
                    showToast(delivery.message);
                }
                contactForm.reset();

            } catch (err) {
                console.error('Quote delivery failed:', err);
                openEmailDraft(formData);
                showToast('Online delivery failed, so an email draft has been opened instead.');
                contactForm.reset();
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
});

async function deliverQuote(formData) {
    if (window.location.protocol !== 'file:') {
        try {
            const response = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (response.ok && result.emailSent) {
                return { sent: true, message: 'Request sent to Antonio successfully.' };
            }
        } catch (error) {
            console.warn('Backend quote delivery unavailable:', error);
        }
    }

    try {
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                access_key: '55dfd813-f9ec-45ec-90d5-b9f1d05aa857',
                subject: `New IT Repair Request from ${formData.name} (${formData.phone})`,
                from_name: "Coast Turtle's IT Land Website",
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                services: formData.services,
                estimate: formData.estimate,
                message: formData.message
            })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            return { sent: true, message: 'Request sent to Antonio successfully.' };
        }
    } catch (error) {
        console.warn('Web3Forms delivery unavailable:', error);
    }

    try {
        const response = await fetch('https://formsubmit.co/ajax/antoniosandu21@gmail.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                _subject: `New IT Repair Request from ${formData.name} (${formData.phone})`,
                _template: 'table',
                _captcha: false,
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                services: formData.services || 'Not specified',
                estimate: formData.estimate || 'Not specified',
                message: formData.message
            })
        });
        const result = await response.json();
        if (response.ok && result.success !== false) {
            return { sent: true, message: 'Request submitted to Antonio successfully. Check your inbox for any activation email.' };
        }
    } catch (error) {
        console.warn('FormSubmit delivery unavailable:', error);
    }

    return { sent: false };
}

function openEmailDraft(formData) {
    const subject = encodeURIComponent(`IT repair request from ${formData.name}`);
    const body = encodeURIComponent([
        `Name: ${formData.name}`,
        `Phone: ${formData.phone}`,
        `Email: ${formData.email}`,
        `Services: ${formData.services || 'Not specified'}`,
        `Estimate: ${formData.estimate || 'Not specified'}`,
        '',
        formData.message
    ].join('\n'));
    window.location.href = `mailto:antoniosandu21@gmail.com?subject=${subject}&body=${body}`;
}

function renderMinimalAbout() {
    const main = document.querySelector('main');
    if (!main) return;

    main.className = 'flex-grow py-16';
    main.innerHTML = `
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid lg:grid-cols-5 gap-12 items-start">
                <div class="lg:col-span-3">
                    <span class="text-xs font-bold uppercase tracking-wider text-blue-600">A little introduction</span>
                    <h2 class="text-4xl sm:text-5xl font-extrabold text-slate-900 mt-2">Hi, I'm Antonio.</h2>
                    <p class="text-xl text-slate-600 leading-relaxed mt-6">I'm 24, passionate about computers, and building a local IT service that feels personal, practical, and easy to trust.</p>
                    <p class="text-slate-600 leading-relaxed mt-4">Alongside my three-year Computer Science degree, I have 1.5 years of experience as a Service Desk Engineer. That means I am used to listening carefully, finding the real cause of a problem, and explaining the solution without unnecessary jargon.</p>
                    <p class="text-slate-600 leading-relaxed mt-4">Outside of technology, I enjoy cars and a good hot chocolate. Those interests keep me curious, patient, and hands-on, which is exactly how I approach a repair or a new setup.</p>
                </div>
                <aside class="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
                    <h3 class="text-xl font-bold text-slate-900">What I want to bring locally</h3>
                    <p class="text-slate-600 text-sm leading-relaxed mt-3">My aim is to make reliable technical help more accessible around Cheltenham and Gloucestershire, especially for people who feel overwhelmed by computer problems.</p>
                    <ul class="space-y-4 mt-6 text-sm text-slate-700">
                        <li class="flex gap-3"><span class="text-blue-600 font-bold">01</span><span>Clear prices and honest advice before work begins.</span></li>
                        <li class="flex gap-3"><span class="text-blue-600 font-bold">02</span><span>Friendly support for households, students, older users, and small businesses.</span></li>
                        <li class="flex gap-3"><span class="text-blue-600 font-bold">03</span><span>A community-focused service that grows through trust and useful work.</span></li>
                    </ul>
                    <a href="contact.html" class="inline-flex bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-xl mt-7">Talk about your problem</a>
                </aside>
            </div>
        </div>`;
}

// Save to Browser Database
function saveToLocalDatabase(entry) {
    let database = JSON.parse(localStorage.getItem('antonio_quote_submissions') || '[]');
    database.push(entry);
    localStorage.setItem('antonio_quote_submissions', JSON.stringify(database));
    console.log('Saved entry to local database:', entry);
}

// Accessibility toolbar: dyslexia-friendly font toggle
function initAccessibilityToolbar() {
    const topBar = document.querySelector('body > div.bg-slate-900');
    const topBarContent = topBar ? topBar.firstElementChild : null;

    if (topBarContent && !document.getElementById('ui-modes-slot')) {
        const contactDetails = topBarContent.lastElementChild;
        if (contactDetails && contactDetails !== topBarContent.firstElementChild) {
            contactDetails.remove();
        }

        topBarContent.classList.remove('justify-between');
        topBarContent.classList.add('justify-end');

        const toolbarSlot = document.createElement('div');
        toolbarSlot.id = 'ui-modes-slot';
        toolbarSlot.className = 'flex items-center gap-2';
        topBarContent.appendChild(toolbarSlot);
    }

    if (localStorage.getItem('mode_dyslexic') === 'true') document.body.classList.add('dyslexic-mode');

    // Create & append UI Widget if not present
    if (!document.getElementById('accessibility-widget')) {
        const widget = document.createElement('div');
        widget.id = 'accessibility-widget';
        widget.className = 'ui-modes-box bg-slate-800/80 backdrop-blur rounded-lg border border-slate-700 flex items-center gap-1.5 p-1.5';
        widget.innerHTML = `
            <span class="text-[10px] font-bold text-green-300 uppercase tracking-wider px-1">Readability</span>
            <button id="btn-mode-dyslexic" title="Toggle dyslexia-friendly font" aria-label="Toggle dyslexia-friendly font" class="ui-mode-button">Aa
            </button>
        `;
        const toolbarTarget = document.getElementById('ui-modes-slot');
        (toolbarTarget || document.body).appendChild(widget);

        document.getElementById('btn-mode-dyslexic').addEventListener('click', () => {
            document.body.classList.toggle('dyslexic-mode');
            const isDyslexic = document.body.classList.contains('dyslexic-mode');
            localStorage.setItem('mode_dyslexic', isDyslexic);
            showToast(isDyslexic ? "Dyslexia-Friendly Font Enabled" : "Standard Font Enabled");
        });
    }
}

// Toast notification helper
function showToast(message) {
    const existing = document.getElementById('toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'fixed bottom-5 right-5 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 border border-slate-700 animate-bounce';
    toast.innerHTML = `
        <svg class="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="text-sm font-medium">${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast) toast.remove();
    }, 4500);
}
