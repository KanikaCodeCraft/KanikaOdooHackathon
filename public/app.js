// Initialize Global Session Variables from Local Storage
let TOKEN = localStorage.getItem('token') || null;
let CURRENT_ROLE = localStorage.getItem('role') || null;
let USER_EMAIL = localStorage.getItem('email') || null; // Captured dynamically now

// --- INITIALIZATION ON DOM LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    if (TOKEN) {
        showPlatform();
    }
    
    // 1. Auth Form Submission Handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const selectedRole = document.getElementById('login-role').value;
            const errorDiv = document.getElementById('login-error');
            
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                
                if (!res.ok) throw new Error(data.error || 'Login failed');
                if (data.user.role !== selectedRole) {
                    throw new Error('Access denied: Selected role does not match assigned user role.');
                }
                
                // Track all key variables dynamically
                TOKEN = data.token;
                CURRENT_ROLE = data.user.role;
                USER_EMAIL = data.user.email;
                
                localStorage.setItem('token', TOKEN);
                localStorage.setItem('role', CURRENT_ROLE);
                localStorage.setItem('email', USER_EMAIL);
                
                if (errorDiv) errorDiv.classList.add('hidden');
                showPlatform();
            } catch (err) {
                if (errorDiv) {
                    errorDiv.querySelector('p').innerText = `❌ ${err.message}`;
                    errorDiv.classList.remove('hidden');
                }
            }
        });
    }

    // 2. Vehicle Creation Form Handler
    const vehicleForm = document.getElementById('vehicle-form');
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                registration_number: document.getElementById('v-reg').value,
                model: document.getElementById('v-model').value,
                type: document.getElementById('v-type').value,
                max_load_capacity: parseFloat(document.getElementById('v-capacity').value),
                odometer: parseFloat(document.getElementById('v-odometer').value),
                acquisition_cost: parseFloat(document.getElementById('v-cost').value)
            };

            const res = await apiFetch('/api/vehicles', 'POST', payload);
            if (res) {
                toggleModal('vehicle-modal', false);
                vehicleForm.reset();
                loadVehicles(); 
                loadDashboardMetrics(); // <-- ADD THIS LINE!
            }
        });
    }

    // 3. Driver Form Submission Listener
    const driverForm = document.getElementById('driver-form');
    if (driverForm) {
        driverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById('d-name').value,
                license_number: document.getElementById('d-license').value,
                license_expiry: document.getElementById('d-expiry').value,
                safety_score: parseInt(document.getElementById('d-score').value)
            };
            const res = await apiFetch('/api/drivers', 'POST', payload);
            if (res) {
                toggleModal('driver-modal', false);
                driverForm.reset();
                loadDrivers();
            }
        });
    }

    // 4. Integrated Trip Form Handler
    const directForm = document.getElementById('direct-trip-form');
    if (directForm) {
        directForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                source: document.getElementById('dt-source').value,
                destination: document.getElementById('dt-dest').value,
                vehicle_id: parseInt(document.getElementById('dt-vehicle').value),
                driver_id: parseInt(document.getElementById('dt-driver').value),
                cargo_weight: parseFloat(document.getElementById('dt-weight').value),
                planned_distance: parseFloat(document.getElementById('dt-distance').value)
            };

            const res = await apiFetch('/api/trips', 'POST', payload);
            if (res) {
                await apiFetch(`/api/trips/${res.id}/dispatch`, 'PUT');
                directForm.reset();
                const banner = document.getElementById('dt-validation-banner');
                if (banner) banner.classList.add('hidden');
                loadTrips();
            }
        });
    }

    // 5. Settings Configuration Form Handler
    const settingsForm = document.getElementById('settings-general-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('s-depot-name').value;
            localStorage.setItem('depot_name', name);
            alert(`⚙️ Depot name configuration successfully saved as: ${name}`);
        });
    }

    // 8. Administrative User Provisioning Form Handler
    const rbacUserForm = document.getElementById('rbac-user-form');
    if (rbacUserForm) {
        rbacUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                name: document.getElementById('nu-name').value,
                email: document.getElementById('nu-email').value,
                password: document.getElementById('nu-password').value,
                role: document.getElementById('nu-role').value
            };

            const res = await apiFetch('/api/auth/register', 'POST', payload);
            if (res) {
                alert(`🚀 Account Successfully Authorized!\nUser profile created for ${payload.name} as a ${payload.role}.`);
                rbacUserForm.reset();
            }
        });
    }

    // 9. Fleet Search and Filter Listeners
    const filterType = document.getElementById('f-filter-type');
    const filterStatus = document.getElementById('f-filter-status');
    const searchReg = document.getElementById('f-search-reg');
    if (filterType) filterType.addEventListener('change', loadVehicles);
    if (filterStatus) filterStatus.addEventListener('change', loadVehicles);
    if (searchReg) searchReg.addEventListener('input', loadVehicles);

    // 10. Maintenance Form Submission Listener
    const maintForm = document.getElementById('maintenance-form');
    if (maintForm) {
        maintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const vehicleId = document.getElementById('m-vehicle').value;
            const payload = {
                description: document.getElementById('m-type').value,
                cost: parseFloat(document.getElementById('m-cost').value)
            };
            const res = await apiFetch(`/api/vehicles/${vehicleId}/maintenance`, 'POST', payload);
            if (res) {
                maintForm.reset();
                loadMaintenanceWorkspace();
                loadDashboardMetrics();
            }
        });
    }

    // 11. Fuel Logging Submission Listener
    const fuelForm = document.getElementById('fuel-log-form');
    if (fuelForm) {
        fuelForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                vehicle_id: parseInt(document.getElementById('fl-vehicle-id').value),
                liters: parseFloat(document.getElementById('fl-liters').value),
                cost: parseFloat(document.getElementById('fl-cost').value)
            };
            const res = await apiFetch('/api/expenses/fuel', 'POST', payload);
            if (res) {
                toggleModal('fuel-modal', false);
                fuelForm.reset();
                loadExpensesWorkspace();
            }
        });
    }

    // 12. Route Expense Submission Listener
    const otherExpenseForm = document.getElementById('other-expense-form');
    if (otherExpenseForm) {
        otherExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                vehicle_id: parseInt(document.getElementById('oe-vehicle-id').value),
                log_type: document.getElementById('oe-type').value,
                cost: parseFloat(document.getElementById('oe-cost').value)
            };
            const res = await apiFetch('/api/expenses/other', 'POST', payload);
            if (res) {
                toggleModal('other-expense-modal', false);
                otherExpenseForm.reset();
                loadExpensesWorkspace();
            }
        });
    }
});

// --- PLATFORM UTILITIES ---
async function apiFetch(url, method = 'GET', body = null) {
    const headers = { 'Authorization': `Bearer ${TOKEN}` };
    if (body) headers['Content-Type'] = 'application/json';

    try {
        const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'API Error Request failed');
        return data;
    } catch (err) {
        alert(`⚠️ Rule Violation: ${err.message}`);
        return null;
    }
}

function showPlatform() {
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    const userDisplay = document.getElementById('user-display');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appLayout) appLayout.classList.remove('hidden');
    if (userDisplay) userDisplay.innerText = `Role: ${CURRENT_ROLE}`;
    
    renderRoleBasedUI();
    switchTab('dashboard');
}

function renderRoleBasedUI() {
    const headerUsername = document.getElementById('header-username');
    const avatarCircle = headerUsername?.nextElementSibling;
    
    // Extract everything before the '@' sign as the display username string
    let displayName = USER_EMAIL ? USER_EMAIL.split('@')[0] : "User";

    if (headerUsername) {
        headerUsername.innerText = `${displayName} (${CURRENT_ROLE})`;
    }
    
    if (avatarCircle) {
        // Take the first two characters of the dynamic handle for the avatar circular tag
        avatarCircle.innerText = displayName.substring(0, 2).toUpperCase();
    }

    // 2. Enforce Sidebar Link Visibility Mapping (RBAC Restrictions)
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        const tabTarget = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
        
        if (tabTarget === 'dashboard') {
            btn.classList.remove('hidden');
            return;
        }

        let standardHasAccess = false;

        if (CURRENT_ROLE === 'Fleet Manager') {
            standardHasAccess = ['vehicles', 'maintenance', 'analytics', 'settings'].includes(tabTarget);
        } else if (CURRENT_ROLE === 'Dispatcher') {
            standardHasAccess = ['trips'].includes(tabTarget);
        } else if (CURRENT_ROLE === 'Safety Officer') {
            standardHasAccess = ['drivers'].includes(tabTarget);
        } else if (CURRENT_ROLE === 'Financial Analyst') {
            standardHasAccess = ['expenses', 'analytics'].includes(tabTarget);
        }

        if (standardHasAccess) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    });
}

function logout() {
    localStorage.clear();
    location.reload();
}

// --- CLIENT ROUTING & NAVIGATION ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const targetedTab = document.getElementById(`tab-${tabName}`);
    if (targetedTab) targetedTab.classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-gray-800', 'text-indigo-400');
        btn.classList.add('text-gray-400');
    });
    
    const activeBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => 
        btn.getAttribute('onclick').includes(`'${tabName}'`)
    );
    if (activeBtn) {
        activeBtn.classList.add('bg-gray-800', 'text-indigo-400');
        activeBtn.classList.remove('text-gray-400');
    }

    if (tabName === 'dashboard') loadDashboardMetrics();
    if (tabName === 'vehicles') loadVehicles();
    if (tabName === 'drivers') loadDrivers();
    if (tabName === 'trips') loadTrips();
    if (tabName === 'maintenance') loadMaintenanceWorkspace();
    if (tabName === 'expenses') loadExpensesWorkspace();
    if (tabName === 'analytics') loadAnalyticsWorkspace();
}

function toggleModal(id, open) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (open) modal.classList.replace('hidden', 'flex');
    else modal.classList.replace('flex', 'hidden');
}

// --- DYNAMIC PAGE LOADERS & EVENT LOGIC ---

async function loadDashboardMetrics() {
    const kpi = await apiFetch('/api/vehicles/dashboard/kpis');
    if (kpi) {
        document.getElementById('kpi-active').innerText = kpi.active_vehicles || 0;
        document.getElementById('kpi-available').innerText = kpi.available_vehicles || 0;
        document.getElementById('kpi-shop').innerText = kpi.vehicles_in_maintenance || 0;
        document.getElementById('kpi-active-trips').innerText = kpi.active_trips || 0;
        document.getElementById('kpi-pending-trips').innerText = kpi.pending_trips || 0;
        document.getElementById('kpi-drivers').innerText = kpi.drivers_on_duty || 0;
        document.getElementById('kpi-utilization').innerText = `${kpi.fleet_utilization_percent || 0}%`;

        // Update status counts and progress bars
        const total = kpi.total_vehicles || 1;
        document.getElementById('status-count-avail').innerText = kpi.available_vehicles || 0;
        document.getElementById('status-bar-avail').style.width = `${Math.round(((kpi.available_vehicles || 0) / total) * 100)}%`;

        document.getElementById('status-count-trip').innerText = kpi.active_vehicles || 0;
        document.getElementById('status-bar-trip').style.width = `${Math.round(((kpi.active_vehicles || 0) / total) * 100)}%`;

        document.getElementById('status-count-shop').innerText = kpi.vehicles_in_maintenance || 0;
        document.getElementById('status-bar-shop').style.width = `${Math.round(((kpi.vehicles_in_maintenance || 0) / total) * 100)}%`;
    }

    // Fetch recent trips list
    const trips = await apiFetch('/api/trips');
    if (trips) {
        const tbody = document.getElementById('dashboard-trips-body');
        if (tbody) {
            tbody.innerHTML = '';
            // Display last 5 trips (most recent) in reverse chronological order
            const recentTrips = trips.slice(-5).reverse();
            recentTrips.forEach(t => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-900/20';
                
                let statusBadge = '';
                if (t.status === 'Completed') {
                    statusBadge = `<span class="bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded font-bold">Completed</span>`;
                } else if (t.status === 'Dispatched') {
                    statusBadge = `<span class="bg-blue-950/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded font-bold">Dispatched</span>`;
                } else if (t.status === 'Cancelled') {
                    statusBadge = `<span class="bg-red-950/40 text-red-400 border border-red-800/40 px-2 py-0.5 rounded font-bold">Cancelled</span>`;
                } else {
                    statusBadge = `<span class="bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded font-bold">Draft</span>`;
                }

                tr.innerHTML = `
                    <td class="p-3.5 pl-4 font-semibold text-white">${t.source} ➔ ${t.destination}</td>
                    <td class="p-3.5 font-mono">${t.registration_number || `ID: ${t.vehicle_id}`}</td>
                    <td class="p-3.5">${t.driver_name || `ID: ${t.driver_id}`}</td>
                    <td class="p-3.5">${statusBadge}</td>
                    <td class="p-3.5 pr-4 text-gray-400 font-mono">-</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // Refresh the live auditing logs stream
    await loadAuditLogs();
}

async function loadAuditLogs() {
    const container = document.getElementById('audit-log-container');
    if (!container) return;

    const logs = await apiFetch('/api/audit-logs');
    if (!logs || logs.length === 0) {
        container.innerHTML = `<div class="text-gray-500 text-center py-6 text-xs select-none">No auditing logs recorded yet.</div>`;
        return;
    }

    container.innerHTML = '';
    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'flex items-start gap-4 relative z-10 transition-all duration-300 hover:translate-x-1';

        // Select an icon and badge color style based on the action
        let iconName = 'activity';
        let colorClasses = 'bg-slate-800 text-indigo-400 border-indigo-500/20';

        const action = log.action.toLowerCase();
        if (action.includes('login')) {
            iconName = 'key-round';
            colorClasses = 'bg-indigo-950/50 text-indigo-300 border-indigo-800/40';
        } else if (action.includes('register')) {
            iconName = 'user-plus';
            colorClasses = 'bg-teal-950/50 text-teal-300 border-teal-800/40';
        } else if (action.includes('created') || action.includes('initialized')) {
            iconName = 'plus-circle';
            colorClasses = 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40';
        } else if (action.includes('dispatched')) {
            iconName = 'navigation';
            colorClasses = 'bg-blue-950/50 text-blue-300 border-blue-800/40';
        } else if (action.includes('completed') || action.includes('resolved')) {
            iconName = 'check-circle-2';
            colorClasses = 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40';
        } else if (action.includes('cancelled') || action.includes('deleted')) {
            iconName = 'alert-triangle';
            colorClasses = 'bg-rose-950/50 text-rose-300 border-rose-800/40';
        } else if (action.includes('maintenance')) {
            iconName = 'wrench';
            colorClasses = 'bg-amber-950/50 text-amber-300 border-amber-800/40';
        }

        // Format timestamp cleanly
        let timeFormatted = '';
        if (log.timestamp) {
            try {
                // Parse timestamp and adapt to nice format
                const date = new Date(log.timestamp);
                timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + date.toLocaleDateString([], { day: '2-digit', month: 'short' });
            } catch (e) {
                timeFormatted = log.timestamp;
            }
        }

        item.innerHTML = `
            <div class="w-8 h-8 rounded-lg flex items-center justify-center border ${colorClasses} shrink-0 shadow-md">
                <i data-lucide="${iconName}" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-white text-xs tracking-wide">${log.action}</span>
                    <span class="text-[9px] text-slate-500 font-mono">${timeFormatted}</span>
                </div>
                <p class="text-[11px] text-slate-400 font-medium mt-0.5">${log.details}</p>
                <div class="flex items-center gap-1 mt-1 text-[9px] font-semibold text-slate-500 uppercase tracking-widest font-mono">
                    <i data-lucide="user" class="w-2.5 h-2.5"></i>
                    <span>${log.logged_by}</span>
                </div>
            </div>
        `;

        container.appendChild(item);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

async function loadVehicles() {
    const typeFilter = document.getElementById('f-filter-type')?.value;
    const statusFilter = document.getElementById('f-filter-status')?.value;
    const regSearch = document.getElementById('f-search-reg')?.value;

    let url = '/api/vehicles';
    const queryParams = [];
    if (typeFilter) queryParams.push(`type=${encodeURIComponent(typeFilter)}`);
    if (statusFilter) queryParams.push(`status=${encodeURIComponent(statusFilter)}`);
    
    if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
    }

    let vehicles = await apiFetch(url);
    if (vehicles) {
        // Filter locally by registration number if search query present
        if (regSearch) {
            vehicles = vehicles.filter(v => v.registration_number.toLowerCase().includes(regSearch.toLowerCase()));
        }

        const tbody = document.getElementById('vehicle-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            vehicles.forEach(v => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-900/20';

                let statusColor = 'text-gray-400';
                if (v.status === 'Available') statusColor = 'text-emerald-400 font-bold';
                else if (v.status === 'On Trip') statusColor = 'text-blue-400 font-bold';
                else if (v.status === 'In Shop') statusColor = 'text-amber-500 font-bold';
                else if (v.status === 'Retired') statusColor = 'text-red-500 font-semibold';

                tr.innerHTML = `
                    <td class="p-4 pl-5 font-mono font-bold text-white">${v.registration_number}</td>
                    <td class="p-4">${v.model}</td>
                    <td class="p-4 font-semibold">${v.type}</td>
                    <td class="p-4 font-mono">${v.max_load_capacity} kg</td>
                    <td class="p-4 font-mono">${v.odometer} km</td>
                    <td class="p-4 font-mono">₹${v.acquisition_cost}</td>
                    <td class="p-4 ${statusColor}">${v.status}</td>
                    <td class="p-4 text-right pr-5">
                        <button onclick="retireVehicle(${v.id})" class="text-red-400 hover:text-red-300 font-bold hover:underline">Retire</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
}

async function retireVehicle(id) {
    if (confirm('Are you sure you want to retire this vehicle asset?')) {
        const res = await apiFetch(`/api/vehicles/${id}`, 'DELETE');
        if (res) {
            loadVehicles();
            loadDashboardMetrics();
        }
    }
}

let DRIVER_STATUS_FILTER = '';

async function loadDrivers() {
    let url = '/api/drivers';
    if (DRIVER_STATUS_FILTER) {
        url += `?status=${encodeURIComponent(DRIVER_STATUS_FILTER)}`;
    }
    const drivers = await apiFetch(url);
    if (drivers) {
        const tbody = document.getElementById('driver-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            drivers.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-900/20';

                let statusColor = 'text-gray-400';
                if (d.status === 'Available') statusColor = 'text-emerald-400 font-bold';
                else if (d.status === 'On Trip') statusColor = 'text-blue-400 font-bold';
                else if (d.status === 'Suspended') statusColor = 'text-amber-500 font-bold';
                else if (d.status === 'Off Duty') statusColor = 'text-red-500 font-semibold';

                tr.innerHTML = `
                    <td class="p-4 pl-5 font-bold text-white">${d.name}</td>
                    <td class="p-4 font-mono">${d.license_number}</td>
                    <td class="p-4 font-semibold">${d.license_category || 'Heavy'}</td>
                    <td class="p-4 font-mono">${d.license_expiry_date}</td>
                    <td class="p-4 font-mono">${d.contact_number || '-'}</td>
                    <td class="p-4 font-mono text-center">Completed</td>
                    <td class="p-4 font-bold text-center text-amber-500">${d.safety_score}</td>
                    <td class="p-4 ${statusColor}">${d.status}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
}

function filterDriverStatus(status) {
    DRIVER_STATUS_FILTER = status;
    loadDrivers();
}

async function loadTrips() {
    // Populate dropdown options with available vehicles and drivers
    const vehicles = await apiFetch('/api/vehicles?status=Available');
    const vehicleSelect = document.getElementById('dt-vehicle');
    if (vehicleSelect) {
        vehicleSelect.innerHTML = '<option value="">-- Select Available Vehicle --</option>';
        if (vehicles) {
            vehicles.forEach(v => {
                vehicleSelect.innerHTML += `<option value="${v.id}" data-capacity="${v.max_load_capacity}">${v.registration_number} (${v.model} - Max: ${v.max_load_capacity}kg)</option>`;
            });
        }
    }

    const drivers = await apiFetch('/api/drivers?status=Available');
    const driverSelect = document.getElementById('dt-driver');
    if (driverSelect) {
        driverSelect.innerHTML = '<option value="">-- Select Available Driver --</option>';
        if (drivers) {
            drivers.forEach(d => {
                driverSelect.innerHTML += `<option value="${d.id}">${d.name} (Score: ${d.safety_score})</option>`;
            });
        }
    }

    // Populate Live Board of current trips
    const trips = await apiFetch('/api/trips');
    const liveBoard = document.getElementById('live-board-container');
    if (liveBoard && trips) {
        liveBoard.innerHTML = '';
        
        if (trips.length === 0) {
            liveBoard.innerHTML = '<div class="text-gray-500 text-xs italic">No active dispatch trips logged.</div>';
        }
        
        trips.reverse().forEach(t => {
            const card = document.createElement('div');
            card.className = 'glass-panel rounded-2xl p-5 border border-white/5 space-y-3.5 text-xs shadow-xl';
            
            let statusBadge = '';
            let actionsHtml = '';
            
            if (t.status === 'Draft') {
                statusBadge = '<span class="bg-white/5 text-gray-400 border border-white/10 px-2.5 py-1 rounded-lg font-bold">Draft</span>';
                actionsHtml = `
                    <div class="flex gap-2">
                        <button onclick="dispatchTrip(${t.id})" class="bg-indigo-600 hover:bg-indigo-500 font-bold px-3.5 py-1.5 rounded-xl text-[10px] text-white uppercase shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]">Dispatch</button>
                        <button onclick="cancelTrip(${t.id})" class="text-rose-400 hover:text-rose-300 font-bold px-3 py-1.5 text-[10px] uppercase transition-colors">Cancel</button>
                    </div>
                `;
            } else if (t.status === 'Dispatched') {
                statusBadge = '<span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg font-bold">Dispatched</span>';
                actionsHtml = `
                    <div class="flex gap-2">
                        <button onclick="completeTripFlow(${t.id}, ${t.vehicle_id})" class="bg-emerald-600 hover:bg-emerald-500 font-bold px-3.5 py-1.5 rounded-xl text-[10px] text-white uppercase shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]">Complete Trip</button>
                        <button onclick="cancelTrip(${t.id})" class="text-rose-400 hover:text-rose-300 font-bold px-3 py-1.5 text-[10px] uppercase transition-colors">Cancel</button>
                    </div>
                `;
            } else if (t.status === 'Completed') {
                statusBadge = '<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-bold">Completed</span>';
            } else if (t.status === 'Cancelled') {
                statusBadge = '<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg font-bold">Cancelled</span>';
            }

            card.innerHTML = `
                <div class="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <span class="font-bold text-white font-mono">TRIP #${t.id}</span>
                    ${statusBadge}
                </div>
                <div class="grid grid-cols-2 gap-3 text-gray-400">
                    <div><span class="text-[9px] uppercase font-bold block text-gray-600">Route</span><span class="font-semibold text-gray-300 font-mono">${t.source} ➔ ${t.destination}</span></div>
                    <div><span class="text-[9px] uppercase font-bold block text-gray-600">Distance</span><span class="font-semibold text-gray-300 font-mono">${t.planned_distance} km</span></div>
                    <div><span class="text-[9px] uppercase font-bold block text-gray-600">Vehicle</span><span class="font-semibold text-gray-300 font-mono">${t.registration_number || `ID ${t.vehicle_id}`}</span></div>
                    <div><span class="text-[9px] uppercase font-bold block text-gray-600">Driver</span><span class="font-semibold text-gray-300">${t.driver_name || `ID ${t.driver_id}`}</span></div>
                    <div><span class="text-[9px] uppercase font-bold block text-gray-600">Cargo Weight</span><span class="font-semibold text-gray-300 font-mono">${t.cargo_weight} kg</span></div>
                    <div><span class="text-[9px] uppercase font-bold block text-gray-600">Date</span><span class="font-semibold text-gray-300 font-mono">${new Date(t.created_at).toLocaleDateString()}</span></div>
                </div>
                ${actionsHtml ? `<div class="pt-2.5 border-t border-white/5 flex justify-between items-center">${actionsHtml}</div>` : ''}
            `;
            liveBoard.appendChild(card);
        });
    }
}

async function dispatchTrip(id) {
    const res = await apiFetch(`/api/trips/${id}/dispatch`, 'PUT');
    if (res) {
        loadTrips();
        loadDashboardMetrics();
    }
}

async function cancelTrip(id) {
    if (confirm('Cancel this dispatch trip?')) {
        const res = await apiFetch(`/api/trips/${id}/cancel`, 'PUT');
        if (res) {
            loadTrips();
            loadDashboardMetrics();
        }
    }
}

async function completeTripFlow(id, vehicleId) {
    const finalOdometer = prompt("Enter final vehicle odometer reading (km):");
    if (!finalOdometer) return;
    
    const fuelLiters = prompt("Fuel Liter Quantity (optional):", "0");
    const fuelCost = prompt("Fuel transaction cost (optional):", "0");
    
    const payload = {
        final_odometer: parseFloat(finalOdometer),
        fuel_liters: parseFloat(fuelLiters) || null,
        fuel_cost: parseFloat(fuelCost) || null
    };

    const res = await apiFetch(`/api/trips/${id}/complete`, 'PUT', payload);
    if (res) {
        loadTrips();
        loadDashboardMetrics();
    }
}

function validateLiveTripPayload() {
    const vehicleSelect = document.getElementById('dt-vehicle');
    const weightInput = document.getElementById('dt-weight');
    const banner = document.getElementById('dt-validation-banner');
    const submitBtn = document.getElementById('dt-submit-btn');
    const valVcap = document.getElementById('dt-val-vcap');
    const valCweight = document.getElementById('dt-val-cweight');
    const valMsg = document.getElementById('dt-val-msg');
    
    if (!vehicleSelect || !weightInput) return;
    
    const selectedOpt = vehicleSelect.options[vehicleSelect.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
        if (banner) banner.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = false;
        return;
    }
    
    const maxCapacity = parseFloat(selectedOpt.getAttribute('data-capacity')) || 0;
    const weight = parseFloat(weightInput.value) || 0;
    
    if (weight > maxCapacity) {
        if (valVcap) valVcap.innerText = `Vehicle Max Load: ${maxCapacity} kg`;
        if (valCweight) valCweight.innerText = `Requested Cargo Weight: ${weight} kg`;
        if (valMsg) valMsg.innerText = `❌ Cargo weight exceeds vehicle's maximum load capacity by ${weight - maxCapacity} kg`;
        if (banner) banner.classList.remove('hidden');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } else {
        if (banner) banner.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

async function loadMaintenanceWorkspace() {
    // Populate vehicle select dropdown
    const vehicles = await apiFetch('/api/vehicles');
    const select = document.getElementById('m-vehicle');
    if (select) {
        select.innerHTML = '<option value="">-- Select Vehicle --</option>';
        if (vehicles) {
            vehicles.forEach(v => {
                select.innerHTML += `<option value="${v.id}">${v.registration_number} (${v.model} - Status: ${v.status})</option>`;
            });
        }
    }

    // Populate maintenance logs list table
    const logs = await apiFetch('/api/vehicles/maintenance/logs');
    const tbody = document.getElementById('maintenance-table-body');
    if (tbody && logs) {
        tbody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-900/20';

            let statusCell = '';
            let actionCell = '';

            if (log.is_closed === 0) {
                statusCell = '<span class="text-amber-500 font-bold">In Shop</span>';
                actionCell = `<button onclick="closeMaintenance(${log.vehicle_id})" class="bg-indigo-600 hover:bg-indigo-500 font-bold px-3 py-1.5 rounded-lg text-[10px] text-white uppercase shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all">Resolve</button>`;
            } else {
                statusCell = '<span class="text-emerald-400 font-medium">Completed</span>';
                actionCell = '<span class="text-gray-500 font-mono text-[10px]">Closed</span>';
            }

            tr.innerHTML = `
                <td class="p-4 pl-5 font-mono font-bold text-white">${log.registration_number} (${log.model})</td>
                <td class="p-4 font-semibold text-gray-300">${log.description}</td>
                <td class="p-4 font-mono">₹${log.cost}</td>
                <td class="p-4">${statusCell}</td>
                <td class="p-4 text-right pr-5">${actionCell}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

async function closeMaintenance(vehicleId) {
    const res = await apiFetch(`/api/vehicles/${vehicleId}/maintenance/close`, 'PUT');
    if (res) {
        loadMaintenanceWorkspace();
        loadDashboardMetrics();
    }
}

async function loadExpensesWorkspace() {
    // Render Fuel Logs Table
    const fuelLogs = await apiFetch('/api/expenses/fuel');
    const tbody = document.getElementById('fuel-table-body');
    if (tbody && fuelLogs) {
        tbody.innerHTML = '';
        fuelLogs.forEach(log => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-900/20';
            tr.innerHTML = `
                <td class="p-3.5 pl-5 font-mono font-bold text-white">${log.registration_number}</td>
                <td class="p-3.5 font-mono">${log.logged_date}</td>
                <td class="p-3.5 font-mono text-gray-300">${log.liters} L</td>
                <td class="p-3.5 pr-5 font-mono text-amber-500 font-bold">₹${log.cost}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Compute Total Operational Cost (Fuel + Maintenance + General Overhead)
    const stats = await apiFetch('/api/expenses/analytics');
    if (stats) {
        const total = stats.reduce((sum, item) => sum + (parseFloat(item.total_operational_cost) || 0), 0);
        const totalCostEl = document.getElementById('expense-total-cost-calc');
        if (totalCostEl) {
            totalCostEl.innerText = `₹${total.toLocaleString('en-IN')}`;
        }
    }
}

async function loadAnalyticsWorkspace() {
    const stats = await apiFetch('/api/expenses/analytics');
    const kpi = await apiFetch('/api/vehicles/dashboard/kpis');
    
    if (stats) {
        // Average Fuel Efficiency
        const validEffs = stats.map(s => parseFloat(s.fuel_efficiency_km_l) || 0).filter(v => v > 0);
        const avgEfficiency = validEffs.length > 0 ? (validEffs.reduce((a, b) => a + b, 0) / validEffs.length).toFixed(1) : '0';
        document.getElementById('an-kpi-efficiency').innerText = `${avgEfficiency} km/l`;

        // Fleet Utilization from metrics
        if (kpi) {
            document.getElementById('an-kpi-utilization').innerText = `${kpi.fleet_utilization_percent || 0}%`;
        }

        // Total operational cost
        const totalCost = stats.reduce((sum, item) => sum + (parseFloat(item.total_operational_cost) || 0), 0);
        document.getElementById('an-kpi-cost').innerText = `₹${totalCost.toLocaleString('en-IN')}`;

        // Average Vehicle ROI
        const validRois = stats.map(s => parseFloat(s.vehicle_roi_percentage) || 0);
        const avgRoi = validRois.length > 0 ? (validRois.reduce((a, b) => a + b, 0) / validRois.length).toFixed(1) : '0';
        document.getElementById('an-kpi-roi').innerText = `${avgRoi}%`;

        // Render Monthly Revenue Chart (Dynamic simulation based on actual operation levels)
        const chart = document.getElementById('analytics-revenue-chart');
        if (chart) {
            chart.innerHTML = '';
            
            // Base calculation relative to operational costs plus a markup simulating margins
            const baseRevenue = stats.reduce((sum, item) => {
                const opCost = parseFloat(item.total_operational_cost) || 0;
                return sum + opCost * 1.5;
            }, 65000);

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
            const monthlyValues = [
                Math.round(baseRevenue * 0.7),
                Math.round(baseRevenue * 0.8),
                Math.round(baseRevenue * 1.1),
                Math.round(baseRevenue * 0.95),
                Math.round(baseRevenue * 1.2),
                Math.round(baseRevenue * 1.3),
                Math.round(baseRevenue * 1.4)
            ];

            const maxVal = Math.max(...monthlyValues, 10000);
            
            months.forEach((month, idx) => {
                const val = monthlyValues[idx];
                const heightPct = Math.min(Math.round((val / maxVal) * 100), 90);
                
                const barWrapper = document.createElement('div');
                barWrapper.className = 'flex flex-col justify-end items-center flex-1 h-full group cursor-pointer';
                barWrapper.innerHTML = `
                    <span class="text-[9px] text-indigo-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-bold">₹${Math.round(val/1000)}k</span>
                    <div class="w-full bg-gradient-to-t from-indigo-800 to-indigo-500 rounded-t transition-all duration-700 ease-out hover:from-amber-600 hover:to-amber-500" style="height: ${heightPct}%"></div>
                    <span class="text-[9px] text-gray-500 font-bold mt-2 uppercase tracking-tight">${month}</span>
                `;
                chart.appendChild(barWrapper);
            });
        }

        // Render Top Costliest Vehicles
        const costliestContainer = document.getElementById('analytics-costliest-container');
        if (costliestContainer) {
            costliestContainer.innerHTML = '';
            
            const sortedVehicles = [...stats]
                .filter(v => v.total_operational_cost > 0)
                .sort((a, b) => b.total_operational_cost - a.total_operational_cost)
                .slice(0, 3);

            if (sortedVehicles.length === 0) {
                costliestContainer.innerHTML = '<div class="text-gray-500 text-xs italic">No operational costs recorded yet.</div>';
            } else {
                sortedVehicles.forEach(v => {
                    const row = document.createElement('div');
                    row.className = 'space-y-1.5';
                    row.innerHTML = `
                        <div class="flex justify-between text-[11px]">
                            <span class="font-bold text-white font-mono">${v.registration_number} (${v.model})</span>
                            <span class="font-bold text-indigo-400 font-mono">₹${v.total_operational_cost.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-indigo-500 h-full" style="width: ${Math.min(100, Math.round((v.total_operational_cost / totalCost) * 100))}%"></div>
                        </div>
                    `;
                    costliestContainer.appendChild(row);
                });
            }
        }
    }
}