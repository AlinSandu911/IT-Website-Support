// Interactive Price Estimator for Antonio's IT Services

const SERVICE_ITEMS = [
    { id: 'diag', name: 'Hardware Diagnostics & Troubleshooting', price: 25 },
    { id: 'os', name: 'OS Reinstallation (Windows 10/11 or Linux + Drivers)', price: 35 },
    { id: 'virus', name: 'Virus, Malware & Spyware Removal', price: 40 },
    { id: 'pcbuild', name: 'Custom PC Assembly & Cable Management', price: 50 },
    { id: 'ssd', name: 'SSD Upgrade & Full Data Disk Cloning', price: 40 },
    { id: 'wifi', name: 'Home/Office Wi-Fi & Network Setup', price: 45 },
    { id: 'backup', name: 'Automated Data Backup Solution Setup', price: 30 }
];

document.addEventListener('DOMContentLoaded', () => {
    const calculatorContainer = document.getElementById('price-calculator');
    if (!calculatorContainer) return;

    renderCalculator();
});

function renderCalculator() {
    const calculatorContainer = document.getElementById('price-calculator');
    
    let itemsHtml = SERVICE_ITEMS.map(item => `
        <label class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-blue-50/50 hover:border-blue-300 transition-all">
            <div class="flex items-center gap-3">
                <input type="checkbox" data-price="${item.price}" data-name="${item.name}" value="${item.id}" class="calc-checkbox w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-slate-300">
                <span class="font-medium text-slate-700">${item.name}</span>
            </div>
            <span class="font-bold text-slate-900">£${item.price}</span>
        </label>
    `).join('');

    calculatorContainer.innerHTML = `
        <div class="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xl max-w-3xl mx-auto">
            <div class="mb-6">
                <h3 class="text-2xl font-bold text-slate-900">Interactive Instant Price Estimator</h3>
                <p class="text-slate-600 mt-1">Select the services you require for a quick estimate. Transparent pricing with no hidden fees.</p>
            </div>

            <div class="space-y-3 mb-6">
                ${itemsHtml}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 mb-6">
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-2">Turnaround Time</label>
                    <select id="calc-speed" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500">
                        <option value="0">Standard Service (24-48 Hours) - Free</option>
                        <option value="25">Express Priority Service (Same Day / Urgent) - +£25</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-2">Service Location</label>
                    <select id="calc-location" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500">
                        <option value="0">Drop-off in Cheltenham - Free</option>
                        <option value="15">On-Site Home Visit in Gloucestershire - +£15</option>
                    </select>
                </div>
            </div>

            <div class="bg-slate-900 text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <span class="text-sm text-slate-400 uppercase tracking-wider font-semibold">Estimated Total Cost</span>
                    <div class="text-4xl font-extrabold text-blue-400 mt-1" id="calc-total">£0</div>
                </div>
                <button id="book-estimate-btn" class="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2">
                    <span>Book Service with Estimate</span>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Add event listeners
    const checkboxes = calculatorContainer.querySelectorAll('.calc-checkbox');
    const speedSelect = document.getElementById('calc-speed');
    const locationSelect = document.getElementById('calc-location');
    const totalDisplay = document.getElementById('calc-total');
    const bookBtn = document.getElementById('book-estimate-btn');

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

        return { total, selectedServices };
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateCalculations));
    speedSelect.addEventListener('change', updateCalculations);
    locationSelect.addEventListener('change', updateCalculations);

    bookBtn.addEventListener('click', () => {
        const { total, selectedServices } = updateCalculations();
        if (selectedServices.length === 0) {
            alert('Please select at least one service before proceeding to booking.');
            return;
        }

        const queryParams = new URLSearchParams({
            services: selectedServices.join(', '),
            estimate: total
        });
        window.location.href = `contact.html?${queryParams.toString()}`;
    });
}
