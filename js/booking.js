document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('booking-form');
    const status = document.getElementById('booking-status');
    const dateInput = document.getElementById('booking-date');
    if (!form || !status) return;

    dateInput.min = new Date().toISOString().split('T')[0];

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const payload = Object.fromEntries(new FormData(form));
        button.disabled = true;
        button.textContent = 'Sending request...';
        status.textContent = '';

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Booking failed');
            status.textContent = result.emailSent ? 'Request sent. Antonio will confirm your appointment shortly.' : 'Request saved. Please also call 07391580090 if you need urgent confirmation.';
            status.className = 'text-sm text-green-500 mt-3 text-center';
            form.reset();
        } catch (error) {
            status.textContent = 'Online booking is unavailable. Please call 07391580090 or email antoniosandu21@gmail.com.';
            status.className = 'text-sm text-red-400 mt-3 text-center';
        } finally {
            button.disabled = false;
            button.textContent = 'Request appointment';
        }
    });
});
