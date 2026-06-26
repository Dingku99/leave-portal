// ===== CONFIGURATION =====
const ADMIN_CONFIG = {
    email: 'dingkujordan@gmail.com',
    password: 'admin123'
};

// ===== FORMSPREE NOTIFICATION ENDPOINTS =====
// Create these forms on Formspree.io
const FORMSPREE_ADMIN = 'https://formspree.io/f/xbdvgkeg';  // Admin notifications
const FORMSPREE_USER = 'https://formspree.io/f/xbdvgkeg';   // User notifications

// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://trqxbomtecdqpsnqnhke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRycXhib210ZWNkcXBzbnFuaGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDA0NDYsImV4cCI6MjA5ODAxNjQ0Nn0.ktjdgU5q33oOPffrHVvAUS3sXmzufIe1NYL-M6F-SRU';

// Initialize Supabase client
let supabaseClient = null;
let supabaseEnabled = false;

function initSupabase() {
    try {
        let supabaseLib = null;
        
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            supabaseLib = window.supabase;
        } else if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseLib = supabase;
        } else {
            setTimeout(initSupabase, 1000);
            return;
        }
        
        supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabaseEnabled = true;
        console.log('✅ Supabase client initialized');
    } catch (e) {
        console.warn('⚠️ Supabase init error:', e);
        setTimeout(initSupabase, 2000);
    }
}

initSupabase();

const ALLOWED_DOMAINS = ['gmail.com', 'iiitmanipur.ac.in'];
const TOTAL_LEAVE = 30;

// ===== DATA STORE =====
let users = [];
let leaves = [];
let currentUser = null;
let currentUserRole = null;
let leaveIdCounter = 1;
let otpStorage = {};
let registrationData = {};
let refreshInterval = null;

// ============================================
// ===== LOAD FROM LOCAL STORAGE =====
// ============================================
function loadData() {
    try {
        const storedUsers = localStorage.getItem('users');
        const storedLeaves = localStorage.getItem('leaves');
        const storedCounter = localStorage.getItem('leaveIdCounter');
        
        if (storedUsers) {
            users = JSON.parse(storedUsers);
        } else {
            users = [
                { id: 1, name: 'Admin', email: ADMIN_CONFIG.email, password: ADMIN_CONFIG.password, role: 'admin', verified: true }
            ];
            saveData();
        }
        
        if (storedLeaves) {
            leaves = JSON.parse(storedLeaves);
        } else {
            leaves = [];
        }
        
        if (storedCounter) {
            leaveIdCounter = parseInt(storedCounter);
        } else {
            leaveIdCounter = 1;
        }
        
        console.log('📁 Local data - Users:', users.length, 'Leaves:', leaves.length);
        return true;
    } catch (e) {
        console.warn('⚠️ Error loading data:', e);
        return false;
    }
}

function saveData() {
    try {
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('leaves', JSON.stringify(leaves));
        localStorage.setItem('leaveIdCounter', String(leaveIdCounter));
        console.log('💾 Data saved - Leaves:', leaves.length);
        return true;
    } catch (e) {
        console.warn('⚠️ Error saving data:', e);
        return false;
    }
}

// ============================================
// ===== SUPABASE FUNCTIONS =====
// ============================================
async function syncToSupabase() {
    if (!supabaseEnabled || !supabaseClient) return false;
    
    try {
        console.log('🔄 Syncing to Supabase...');
        
        for (const user of users) {
            await supabaseClient.from('users').upsert(user, { onConflict: 'id' });
        }
        
        for (const leave of leaves) {
            await supabaseClient.from('leaves').upsert(leave, { onConflict: 'id' });
        }
        
        console.log('✅ Synced to Supabase');
        return true;
    } catch (e) {
        console.log('⚠️ Sync failed:', e);
        return false;
    }
}

async function loadFromSupabase() {
    if (!supabaseEnabled || !supabaseClient) return false;
    
    try {
        console.log('🔄 Loading from Supabase...');
        
        const { data: usersData } = await supabaseClient.from('users').select('*');
        const { data: leavesData } = await supabaseClient.from('leaves').select('*');
        
        // Keep admin, add others
        const adminUser = users.find(u => u.role === 'admin');
        users = usersData || [];
        if (adminUser && !users.find(u => u.id === adminUser.id)) {
            users.push(adminUser);
        }
        
        // Replace leaves with Supabase data
        if (leavesData) {
            leaves = leavesData;
        }
        
        saveData();
        console.log('✅ Loaded from Supabase - Leaves:', leaves.length);
        return true;
    } catch (e) {
        console.log('⚠️ Load failed:', e);
        return false;
    }
}

// ============================================
// ===== MANUAL SYNC BUTTONS =====
// ============================================
async function pushToCloud() {
    showToast('🔄 Pushing to cloud...', 'success');
    const success = await syncToSupabase();
    showToast(success ? '✅ Data pushed to cloud!' : '❌ Push failed!', success ? 'success' : 'error');
}

async function pullFromCloud() {
    showToast('🔄 Pulling from cloud...', 'success');
    const success = await loadFromSupabase();
    if (success) {
        if (currentUserRole === 'admin') {
            renderAdminDashboard();
            renderAdminUsers();
        } else if (currentUser) {
            renderEmployeeDashboard();
        }
        showToast('✅ Data pulled from cloud!', 'success');
    } else {
        showToast('❌ Pull failed!', 'error');
    }
}

// ============================================
// ===== FORMSPREE NOTIFICATIONS =====
// ============================================
function sendAdminNotification(leave) {
    fetch(FORMSPREE_ADMIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subject: `📋 New Leave Request from ${leave.employeeName}`,
            message: `
                New leave request submitted!
                
                Employee: ${leave.employeeName}
                Email: ${leave.employeeEmail}
                Type: ${leave.type}
                Days: ${leave.days}
                Start Date: ${formatDate(leave.startDate)}
                End Date: ${formatDate(leave.endDate)}
                Reason: ${leave.reason}
                Status: Pending
                
                Log in to the admin panel to approve or reject.
            `
        })
    })
    .then(() => console.log('📧 Admin notification sent'))
    .catch(() => console.log('⚠️ Admin notification failed'));
}

function sendUserNotification(leave, status) {
    fetch(FORMSPREE_USER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subject: `📋 Leave Request ${status}`,
            message: `
                Your leave request has been ${status.toLowerCase()}!
                
                Employee: ${leave.employeeName}
                Type: ${leave.type}
                Days: ${leave.days}
                Dates: ${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}
                Status: ${status}
                
                ${status === 'Approved' ? '✅ Your leave has been approved. Enjoy your time off!' : '❌ Your leave request has been rejected.'}
            `
        })
    })
    .then(() => console.log('📧 User notification sent'))
    .catch(() => console.log('⚠️ User notification failed'));
}

// ============================================
// ===== OTP FUNCTIONS =====
// ============================================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOTP(email, otp) {
    otpStorage[email] = { otp: otp, timestamp: Date.now() };
    console.log(`📧 OTP for ${email}: ${otp}`);
    alert(`⚠️ OTP for ${email}: ${otp}\n\n(Use this OTP to verify.)`);
}

function verifyOTP(email, otpInput) {
    const stored = otpStorage[email];
    if (!stored) return { valid: false, message: 'No OTP found.' };
    if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
        delete otpStorage[email];
        return { valid: false, message: 'OTP expired.' };
    }
    if (stored.otp === otpInput) {
        delete otpStorage[email];
        return { valid: true, message: 'OTP verified!' };
    }
    return { valid: false, message: 'Invalid OTP.' };
}

// ============================================
// ===== UTILITY FUNCTIONS =====
// ============================================
function getEmployeeLeaves(email) {
    return leaves.filter(l => l.employeeEmail === email);
}

function getUsedLeave(email) {
    const approved = leaves.filter(l => l.employeeEmail === email && l.status === 'Approved');
    return approved.reduce((sum, l) => sum + l.days, 0);
}

function getRemainingLeave(email) {
    return TOTAL_LEAVE - getUsedLeave(email);
}

function getPendingCount(email) {
    return leaves.filter(l => l.employeeEmail === email && l.status === 'Pending').length;
}

function getAllPending() {
    return leaves.filter(l => l.status === 'Pending');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getEmployeeName(email) {
    const user = users.find(u => u.email === email);
    return user ? user.name : email;
}

function isValidEmail(email) {
    const domain = email.split('@')[1];
    if (!domain) return false;
    return ALLOWED_DOMAINS.includes(domain.toLowerCase());
}

// ============================================
// ===== SIMPLIFIED CAPTCHA =====
// ============================================
function loadRecaptcha() {}
function verifyCaptcha() {
    return Promise.resolve(true);
}

// ============================================
// ===== PAGE NAVIGATION =====
// ============================================
function showPage(pageId) {
    document.querySelectorAll('.login-page, .landing-page, #adminDashboard, #employeeDashboard').forEach(el => {
        el.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'flex';
}

function showAdminView(viewId) {
    document.querySelectorAll('#adminDashboard .view-section').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    loadData();
    renderAdminDashboard();
    renderAdminUsers();
}

function showEmployeeView(viewId) {
    document.querySelectorAll('#employeeDashboard .view-section').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    loadData();
    if (viewId === 'empViewDashboard') renderEmployeeDashboard();
    if (viewId === 'empViewHistory') renderEmployeeHistory();
}

// ============================================
// ===== RENDER FUNCTIONS =====
// ============================================
function renderAdminDashboard() {
    const pending = getAllPending();
    const all = leaves;
    const approved = all.filter(l => l.status === 'Approved');
    const rejected = all.filter(l => l.status === 'Rejected');
    
    document.getElementById('adminTotalRequests').textContent = all.length;
    document.getElementById('adminPendingRequests').textContent = pending.length;
    document.getElementById('adminApprovedRequests').textContent = approved.length;
    document.getElementById('adminRejectedRequests').textContent = rejected.length;
    
    const tbody = document.getElementById('adminTableBody');
    if (all.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No leave requests to review</td></tr>';
        return;
    }
    
    tbody.innerHTML = all.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)).map(l => {
        const employeeName = getEmployeeName(l.employeeEmail);
        return `
            <tr>
                <td>${employeeName}</td>
                <td>${l.type}</td>
                <td>${l.days}</td>
                <td>${formatDate(l.startDate)}</td>
                <td>${formatDate(l.endDate)}</td>
                <td>${l.reason.substring(0, 20)}${l.reason.length > 20 ? '...' : ''}</td>
                <td><span class="status-badge status-${l.status.toLowerCase()}">${l.status}</span></td>
                <td>
                    ${l.status === 'Pending' ? `
                        <div class="action-btns">
                            <button class="btn btn-success btn-sm" onclick="approveLeave(${l.id})">Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectLeave(${l.id})">Reject</button>
                        </div>
                    ` : `<span style="color: #6B6B8A;">${l.status}</span>`}
                </td>
            </tr>
        `;
    }).join('');
}

function renderAdminUsers() {
    const tbody = document.getElementById('userTableBody');
    const nonAdminUsers = users.filter(u => u.role !== 'admin');
    
    if (nonAdminUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">No users registered</td></tr>';
        return;
    }
    
    tbody.innerHTML = nonAdminUsers.map(u => `
        <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td><span class="password-cell">${u.password}</span></td>
            <td>${u.verified ? '✅' : '❌'}</td>
            <td>${getUsedLeave(u.email)}</td>
            <td>${getRemainingLeave(u.email)}</td>
            <td>${getPendingCount(u.email)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderEmployeeDashboard() {
    if (!currentUser) return;
    loadData();
    
    document.getElementById('empUserName').textContent = currentUser.name;
    
    const used = getUsedLeave(currentUser.email);
    const remaining = getRemainingLeave(currentUser.email);
    const pending = getPendingCount(currentUser.email);
    
    document.getElementById('empTotalLeave').textContent = TOTAL_LEAVE;
    document.getElementById('empUsedLeave').textContent = used;
    document.getElementById('empRemainingLeave').textContent = remaining;
    document.getElementById('empPendingCount').textContent = pending;
    
    const userLeaves = getEmployeeLeaves(currentUser.email)
        .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
        .slice(0, 5);
    
    const tbody = document.getElementById('empRecentTableBody');
    if (userLeaves.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">No leave applications yet</td></tr>';
    } else {
        tbody.innerHTML = userLeaves.map(l => `
            <tr>
                <td>${formatDate(l.appliedDate)}</td>
                <td>${l.type}</td>
                <td>${l.days}</td>
                <td><span class="status-badge status-${l.status.toLowerCase()}">${l.status}</span></td>
            </tr>
        `).join('');
    }
    
    document.getElementById('empApplyTotalLeave').textContent = TOTAL_LEAVE;
    document.getElementById('empApplyUsedLeave').textContent = used;
    document.getElementById('empApplyRemainingLeave').textContent = remaining;
}

function renderEmployeeHistory() {
    if (!currentUser) return;
    loadData();
    
    const userLeaves = getEmployeeLeaves(currentUser.email)
        .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));
    
    const tbody = document.getElementById('empHistoryTableBody');
    if (userLeaves.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">No leave applications found</td></tr>';
        return;
    }
    
    tbody.innerHTML = userLeaves.map(l => `
        <tr>
            <td>${formatDate(l.appliedDate)}</td>
            <td>${l.type}</td>
            <td>${formatDate(l.startDate)}</td>
            <td>${formatDate(l.endDate)}</td>
            <td>${l.days}</td>
            <td><span class="status-badge status-${l.status.toLowerCase()}">${l.status}</span></td>
            <td>${l.reason.substring(0, 30)}${l.reason.length > 30 ? '...' : ''}</td>
        </tr>
    `).join('');
}

function applyHistoryFilters() {
    const search = document.getElementById('historySearch').value.toLowerCase();
    const filter = document.getElementById('historyFilter').value;
    
    const rows = document.querySelectorAll('#empHistoryTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const statusCell = row.querySelector('.status-badge');
        const statusText = statusCell ? statusCell.textContent : '';
        let show = true;
        if (search && !text.includes(search)) show = false;
        if (filter !== 'all' && statusText !== filter) show = false;
        row.style.display = show ? '' : 'none';
    });
}

// ============================================
// ===== LEAVE ACTIONS WITH FORMSPREE =====
// ============================================
async function approveLeave(id) {
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    
    leave.status = 'Approved';
    saveData();
    await syncToSupabase();
    
    // Send notification to user via Formspree
    sendUserNotification(leave, 'Approved');
    
    renderAdminDashboard();
    renderAdminUsers();
    showToast('✅ Leave approved! User notified.', 'success');
}

async function rejectLeave(id) {
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    
    leave.status = 'Rejected';
    saveData();
    await syncToSupabase();
    
    // Send notification to user via Formspree
    sendUserNotification(leave, 'Rejected');
    
    renderAdminDashboard();
    renderAdminUsers();
    showToast('❌ Leave rejected. User notified.', 'error');
}

async function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user || user.role === 'admin') {
        showToast('❌ Cannot delete admin user.', 'error');
        return;
    }
    
    if (!confirm(`⚠️ Delete ${user.name} and all their records?`)) return;
    
    leaves = leaves.filter(l => l.employeeEmail !== user.email);
    users = users.filter(u => u.id !== userId);
    
    if (supabaseEnabled) {
        await supabaseClient.from('users').delete().eq('id', userId);
        await supabaseClient.from('leaves').delete().eq('employeeEmail', user.email);
    }
    
    saveData();
    renderAdminDashboard();
    renderAdminUsers();
    showToast(`✅ User "${user.name}" deleted.`, 'success');
}

// ============================================
// ===== TOAST NOTIFICATION =====
// ============================================
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        background: ${type === 'success' ? '#50C878' : '#FF6B6B'};
        color: white;
        font-size: 0.95rem;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Add toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .password-cell {
        font-family: 'Courier New', monospace;
        background: #F8FAFE;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 0.8rem;
        letter-spacing: 0.5px;
        border: 1px dashed #D0D0D8;
        display: inline-block;
    }
`;
document.head.appendChild(style);

// ============================================
// ===== PAGE NAVIGATION EVENTS =====
// ============================================
document.getElementById('gotoAdminLogin').addEventListener('click', (e) => { e.preventDefault(); showPage('adminLoginPage'); });
document.getElementById('gotoEmployeeLogin').addEventListener('click', (e) => { e.preventDefault(); showPage('employeeLoginPage'); });
document.getElementById('gotoRegister').addEventListener('click', (e) => { e.preventDefault(); showPage('registerPage'); });
document.getElementById('adminBackToLanding').addEventListener('click', (e) => { e.preventDefault(); showPage('landingPage'); });
document.getElementById('employeeBackToLanding').addEventListener('click', (e) => { e.preventDefault(); showPage('landingPage'); });
document.getElementById('registerBackToLanding').addEventListener('click', (e) => { e.preventDefault(); showPage('landingPage'); });

// ============================================
// ===== ADMIN LOGIN =====
// ============================================
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const errorEl = document.getElementById('adminLoginError');
    
    if (email !== ADMIN_CONFIG.email || password !== ADMIN_CONFIG.password) {
        errorEl.textContent = '❌ Invalid admin credentials.';
        return;
    }
    
    errorEl.textContent = '';
    currentUserRole = 'admin';
    document.getElementById('adminLoginPage').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    
    await loadFromSupabase();
    showAdminView('adminViewDashboard');
});

// ============================================
// ===== EMPLOYEE LOGIN =====
// ============================================
document.getElementById('employeeLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('employeeEmail').value.trim();
    const password = document.getElementById('employeePassword').value.trim();
    const errorEl = document.getElementById('employeeLoginError');
    
    await loadFromSupabase();
    
    const user = users.find(u => u.email === email && u.password === password && u.role !== 'admin');
    
    if (!user) {
        errorEl.textContent = '❌ Invalid email or password.';
        return;
    }
    if (!user.verified) {
        errorEl.textContent = '❌ Email not verified.';
        return;
    }
    
    errorEl.textContent = '';
    currentUser = user;
    currentUserRole = 'employee';
    
    if (document.getElementById('empRememberMe').checked) {
        localStorage.setItem('empRememberedEmail', email);
        localStorage.setItem('empRememberedPassword', password);
    } else {
        localStorage.removeItem('empRememberedEmail');
        localStorage.removeItem('empRememberedPassword');
    }
    
    document.getElementById('employeeLoginPage').style.display = 'none';
    document.getElementById('employeeDashboard').style.display = 'block';
    showEmployeeView('empViewDashboard');
});

// ============================================
// ===== REGISTRATION =====
// ============================================
document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const errorEl = document.getElementById('registerError');
    
    if (!isValidEmail(email)) {
        errorEl.textContent = `❌ Email domain not allowed. Allowed: ${ALLOWED_DOMAINS.join(', ')}`;
        errorEl.style.color = '#FF6B6B';
        return;
    }
    if (!name || !email || !password) {
        errorEl.textContent = '❌ Please fill in all fields.';
        errorEl.style.color = '#FF6B6B';
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = '❌ Password must be at least 6 characters.';
        errorEl.style.color = '#FF6B6B';
        return;
    }
    if (users.find(u => u.email === email)) {
        errorEl.textContent = '❌ Email already registered.';
        errorEl.style.color = '#FF6B6B';
        return;
    }
    
    registrationData = { name, email, password };
    const otp = generateOTP();
    sendOTP(email, otp);
    
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('otpSection').style.display = 'block';
    document.getElementById('otpEmailDisplay').textContent = email;
    errorEl.textContent = '📧 OTP sent! Please check your email.';
    errorEl.style.color = '#50C878';
});

document.getElementById('resendOtpBtn').addEventListener('click', function() {
    const email = registrationData.email;
    if (email) {
        const otp = generateOTP();
        sendOTP(email, otp);
        document.getElementById('registerError').textContent = '📧 New OTP sent!';
        document.getElementById('registerError').style.color = '#50C878';
    }
});

document.getElementById('verifyOtpBtn').addEventListener('click', function() {
    const otpInput = document.getElementById('otpInput').value.trim();
    const errorEl = document.getElementById('registerError');
    
    if (!otpInput || otpInput.length !== 6) {
        errorEl.textContent = '❌ Please enter a valid 6-digit OTP.';
        errorEl.style.color = '#FF6B6B';
        return;
    }
    
    const result = verifyOTP(registrationData.email, otpInput);
    if (!result.valid) {
        errorEl.textContent = `❌ ${result.message}`;
        errorEl.style.color = '#FF6B6B';
        return;
    }
    
    const newUser = {
        id: users.length + 1,
        name: registrationData.name,
        email: registrationData.email,
        password: registrationData.password,
        role: 'employee',
        verified: true
    };
    
    users.push(newUser);
    saveData();
    
    if (supabaseEnabled) {
        setTimeout(() => syncToSupabase(), 500);
    }
    
    errorEl.textContent = '✅ Account created! Please login.';
    errorEl.style.color = '#50C878';
    
    document.getElementById('registerForm').reset();
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('otpSection').style.display = 'none';
    document.getElementById('otpInput').value = '';
    document.getElementById('employeeEmail').value = newUser.email;
    document.getElementById('employeePassword').value = newUser.password;
    
    showToast('✅ Account created! Please login.', 'success');
    setTimeout(() => { errorEl.textContent = ''; }, 5000);
});

// ============================================
// ===== NAVIGATION EVENTS =====
// ============================================
document.getElementById('adminNavDashboard').addEventListener('click', (e) => { e.preventDefault(); showAdminView('adminViewDashboard'); });
document.getElementById('adminNavUsers').addEventListener('click', (e) => { e.preventDefault(); showAdminView('adminViewUsers'); });
document.getElementById('adminNavLogout').addEventListener('click', (e) => {
    e.preventDefault();
    currentUserRole = null;
    document.getElementById('adminDashboard').style.display = 'none';
    showPage('landingPage');
});

document.getElementById('empNavDashboard').addEventListener('click', (e) => { e.preventDefault(); showEmployeeView('empViewDashboard'); });
document.getElementById('empNavApplyLeave').addEventListener('click', (e) => { e.preventDefault(); showEmployeeView('empViewApplyLeave'); });
document.getElementById('empNavHistory').addEventListener('click', (e) => { e.preventDefault(); showEmployeeView('empViewHistory'); });
document.getElementById('empNavLogout').addEventListener('click', (e) => {
    e.preventDefault();
    currentUser = null;
    currentUserRole = null;
    document.getElementById('employeeDashboard').style.display = 'none';
    showPage('landingPage');
});

document.getElementById('empQuickApplyBtn').addEventListener('click', () => { showEmployeeView('empViewApplyLeave'); });

// ============================================
// ===== HISTORY FILTERS =====
// ============================================
document.getElementById('historySearch').addEventListener('input', applyHistoryFilters);
document.getElementById('historyFilter').addEventListener('change', applyHistoryFilters);

// ============================================
// ===== LEAVE FORM =====
// ============================================
document.getElementById('leaveForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const type = document.getElementById('leaveType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const days = parseFloat(document.getElementById('leaveDays').value);
    const reason = document.getElementById('leaveReason').value.trim();
    const messageEl = document.getElementById('formMessage');
    
    if (!type || !startDate || !endDate || !days || !reason) {
        messageEl.textContent = '❌ Please fill in all fields.';
        messageEl.className = 'form-message error';
        return;
    }
    if (days <= 0) {
        messageEl.textContent = '❌ Days must be greater than 0.';
        messageEl.className = 'form-message error';
        return;
    }
    const remaining = getRemainingLeave(currentUser.email);
    if (days > remaining) {
        messageEl.textContent = `❌ You only have ${remaining} days remaining.`;
        messageEl.className = 'form-message error';
        return;
    }
    if (new Date(startDate) > new Date(endDate)) {
        messageEl.textContent = '❌ Start date must be before end date.';
        messageEl.className = 'form-message error';
        return;
    }
    
    const leave = {
        id: leaves.length + 1,
        employeeEmail: currentUser.email,
        employeeName: currentUser.name,
        type: type,
        startDate: startDate,
        endDate: endDate,
        days: days,
        reason: reason,
        status: 'Pending',
        appliedDate: new Date().toISOString()
    };
    
    leaves.push(leave);
    saveData();
    
    // Send notification to admin via Formspree
    sendAdminNotification(leave);
    
    // Push to Supabase
    if (supabaseEnabled) {
        setTimeout(() => syncToSupabase(), 500);
    }
    
    messageEl.textContent = '✅ Leave request submitted! Admin notified.';
    messageEl.className = 'form-message success';
    document.getElementById('leaveForm').reset();
    renderEmployeeDashboard();
    showToast('✅ Leave request submitted!', 'success');
});

// ============================================
// ===== HAMBURGER MENUS =====
// ============================================
const adminHamburger = document.getElementById('adminHamburger');
const adminNavLinks = document.getElementById('adminNavLinks');
if (adminHamburger) {
    adminHamburger.addEventListener('click', () => {
        adminHamburger.classList.toggle('active');
        adminNavLinks.classList.toggle('active');
    });
}
document.querySelectorAll('#adminNavLinks a').forEach(link => {
    link.addEventListener('click', () => {
        adminHamburger.classList.remove('active');
        adminNavLinks.classList.remove('active');
    });
});

const employeeHamburger = document.getElementById('employeeHamburger');
const employeeNavLinks = document.getElementById('employeeNavLinks');
if (employeeHamburger) {
    employeeHamburger.addEventListener('click', () => {
        employeeHamburger.classList.toggle('active');
        employeeNavLinks.classList.toggle('active');
    });
}
document.querySelectorAll('#employeeNavLinks a').forEach(link => {
    link.addEventListener('click', () => {
        employeeHamburger.classList.remove('active');
        employeeNavLinks.classList.remove('active');
    });
});

// ============================================
// ===== LOAD REMEMBERED CREDENTIALS =====
// ============================================
function loadEmployeeCredentials() {
    const email = localStorage.getItem('empRememberedEmail');
    const password = localStorage.getItem('empRememberedPassword');
    if (email && password) {
        document.getElementById('employeeEmail').value = email;
        document.getElementById('employeePassword').value = password;
        document.getElementById('empRememberMe').checked = true;
    }
}

// ============================================
// ===== REFRESH DATA =====
// ============================================
async function refreshData() {
    showToast('🔄 Refreshing...', 'success');
    await loadFromSupabase();
    if (currentUserRole === 'admin') {
        renderAdminDashboard();
        renderAdminUsers();
    } else if (currentUser) {
        renderEmployeeDashboard();
        renderEmployeeHistory();
    }
    showToast('✅ Data refreshed!', 'success');
}

// ============================================
// ===== DEBUG FUNCTION =====
// ============================================
function debugShowData() {
    const panel = document.getElementById('debugPanel');
    if (!panel) return;
    
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    
    const output = document.getElementById('debugOutput');
    if (!output) return;
    
    output.innerHTML = `
📊 DATA STATUS
═══════════════════════════════
📁 Local Users: ${users.length}
📁 Local Leaves: ${leaves.length}
📤 Supabase Connected: ${supabaseEnabled ? '✅ YES' : '❌ NO'}
👤 Current User: ${currentUser ? currentUser.name : 'None'}
🔑 Role: ${currentUserRole || 'None'}

📋 LOCAL LEAVES:
${leaves.length > 0 ? leaves.map(l => `  - ${l.type} (${l.status}) by ${l.employeeName}`).join('\n') : '  (none)'}

👥 LOCAL USERS:
${users.length > 0 ? users.map(u => `  - ${u.name} (${u.role})`).join('\n') : '  (none)'}

💡 Click "⬆️ Push to Cloud" to upload local data
💡 Click "⬇️ Pull from Cloud" to download from Supabase
💡 Click "🔄 Refresh Data" to reload everything
    `;
}

// ============================================
// ===== INIT =====
// ============================================
loadData();
loadEmployeeCredentials();

setTimeout(async () => {
    if (supabaseEnabled) {
        await loadFromSupabase();
        await syncToSupabase();
    }
    if (currentUserRole === 'admin') {
        renderAdminDashboard();
        renderAdminUsers();
    } else if (currentUser) {
        renderEmployeeDashboard();
        renderEmployeeHistory();
    }
}, 3000);

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').setAttribute('min', today);
    document.getElementById('endDate').setAttribute('min', today);
});

console.log('🏛️ IIITM Leave Portal loaded!');
console.log('👤 Admin:', ADMIN_CONFIG.email);
console.log('🔗 Supabase:', supabaseEnabled ? '✅ Connected' : '❌ Not connected');
console.log('📧 Formspree notifications enabled');
console.log('💡 Click "⬆️ Push to Cloud" or "⬇️ Pull from Cloud" to sync');
