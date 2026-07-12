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