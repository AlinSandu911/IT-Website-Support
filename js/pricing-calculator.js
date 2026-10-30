// Interactive Price Estimator for Coast Turtle's IT Land

const SERVICE_ITEMS = [
    { id: 'diag', name: 'Hardware Diagnostics & Troubleshooting', price: 25 },
    { id: 'os', name: 'OS Reinstallation (Windows 10/11 or Linux + Drivers)', price: 35 },
    { id: 'virus', name: 'Virus, Malware & Spyware Removal', price: 40 },
    { id: 'pcbuild', name: 'Custom PC Assembly & Cable Management', price: 50 },
    { id: 'ssd', name: 'SSD Upgrade & Full Data Disk Cloning (+ parts)', price: 40 },
    { id: 'clean', name: 'Overheating Fix & Deep Cleaning', price: 30 },
    { id: 'gpu', name: 'GPU or Power Supply Upgrade (+ parts)', price: 30 },
    { id: 'wifi', name: 'Home/Office Wi-Fi & Network Setup', price: 45 },
    { id: 'backup', name: 'Automated Data Backup Setup', price: 30 }
];

document.addEventListener('DOMContentLoaded', () => {
    const calculatorContainer = document.getElementById('price-calculator');
    if (!calculatorContainer) return;

    renderCalculator();
});

function renderCalculator() {
    const calculatorContainer = document.getElementById('price-calculator');
    
    let itemsHtml = SERVICE_ITEMS.map(item => `
        <label class="flex items-center justify-between p-3.5 bg-sunken border border-line rounded-xl cursor-pointer hover:bg-accent-soft hover:border-accent-border transition-all">
            <div class="flex items-center gap-3">
                <input type="checkbox" data-price="${item.price}" data-name="${item.name}" value="${item.id}" class="calc-checkbox w-5 h-5 text-accent-light rounded focus:ring-accent-bright border-line-strong">
                <span class="font-medium text-ink">${item.name}</span>
            </div>
            <span class="font-bold text-ink">£${item.price}</span>
        </label>
    `).join('');

    calculatorContainer.innerHTML = `
        <div class="bg-surface p-6 md:p-8 rounded-2xl border border-line shadow-xl max-w-3xl mx-auto">
            <div class="mb-6">
                <h3 class="text-2xl font-bold text-ink">Interactive Instant Price Estimator</h3>
                <p class="text-muted mt-1">Select the services you require for a quick estimate. Transparent pricing with no hidden fees.</p>
            </div>

            <div class="space-y-3 mb-6">
                ${itemsHtml}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-line mb-6">
                <div>
                    <label class="block text-sm font-semibold text-ink mb-2">Turnaround Time</label>
                    <select id="calc-speed" class="w-full bg-field border border-line-strong rounded-lg p-3 text-ink focus:ring-2 focus:ring-accent-bright">
                        <option value="0">Standard Service (24-48 Hours) - Free</option>
                        <option value="25">Express Priority Service (Same Day / Urgent) - +£25</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-ink mb-2">Service Location</label>
                    <select id="calc-location" class="w-full bg-field border border-line-strong rounded-lg p-3 text-ink focus:ring-2 focus:ring-accent-bright">
                        <option value="0">Drop-off in Cheltenham - Free</option>
                        <option value="15">On-Site Home Visit in Gloucestershire - +£15</option>
                    </select>
                </div>
            </div>

            <div class="bg-night text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <span class="text-sm text-muted uppercase tracking-wider font-semibold">Estimated Total Cost</span>
                    <div class="text-4xl font-extrabold text-accent-light mt-1" id="calc-total">£0</div>
                </div>
                <button id="book-estimate-btn" class="w-full md:w-auto bg-accent hover:bg-accent-bright text-on-accent px-6 py-3.5 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2">
                    <span>Book Service with Estimate</span>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                </button>
            </div>
            <p id="calc-error" class="hidden text-sm text-red-400 mt-3 text-center" role="alert">Please select at least one service first.</p>
        </div>
    `;

    // Add event listeners
    const checkboxes = calculatorContainer.querySelectorAll('.calc-checkbox');
    const speedSelect = document.getElementById('calc-speed');
    const locationSelect = document.getElementById('calc-location');
    const totalDisplay = document.getElementById('calc-total');
    const bookBtn = document.getElementById('book-estimate-btn');
    const errorMessage = document.getElementById('calc-error');

    function updateCalculations() {
        let total = 0;
        let selectedServices = [];

        checkboxes.forEach(cb => {
            if (cb.checked) {
                total += parseFloat(cb.dataset.price);
                selectedServices.push(cb.dataset.name);
            }
        });

        const speedFee = parseFloat(speedSelect.value) || 0;
        const locationFee = parseFloat(locationSelect.value) || 0;

        total += speedFee + locationFee;
        totalDisplay.textContent = `£${total}`;
        if (selectedServices.length) errorMessage.classList.add('hidden');

        return { total, selectedServices };
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateCalculations));
    speedSelect.addEventListener('change', updateCalculations);
    locationSelect.addEventListener('change', updateCalculations);

    bookBtn.addEventListener('click', () => {
        const { total, selectedServices } = updateCalculations();
        if (selectedServices.length === 0) {
            errorMessage.classList.remove('hidden');
            return;
        }

        const queryParams = new URLSearchParams({
            services: selectedServices.join(', '),
            estimate: total
        });
        window.location.href = `contact.html?${queryParams.toString()}`;
    });
}
