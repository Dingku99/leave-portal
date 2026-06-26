// ===== CONFIGURATION =====
const ADMIN_CONFIG = {
    email: 'dingkujordan@gmail.com',
    password: 'admin123'
};

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
            console.log('✅ Supabase found on window');
        } else if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseLib = supabase;
            console.log('✅ Supabase found globally');
        } else {
            console.warn('⚠️ Supabase not found, will retry...');
            setTimeout(initSupabase, 1000);
            return;
        }
        
        supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabaseEnabled = true;
        console.log('✅ Supabase client initialized successfully!');
        
        setTimeout(() => {
            if (supabaseEnabled) {
                loadFromSupabase();
            }
        }, 1000);
        
    } catch (e) {
        console.warn('⚠️ Supabase initialization error:', e);
        supabaseEnabled = false;
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
let isSyncing = false;
let emailjsReady = false;
let registrationData = {};
let refreshInterval = null;

// ============================================
// ===== CHECK EMAILJS =====
// ============================================
function checkEmailJS() {
    if (typeof emailjs !== 'undefined' && emailjs.send) {
        emailjsReady = true;
        console.log('✅ EmailJS is available and ready');
        return true;
    } else {
        emailjsReady = false;
        console.warn('⚠️ EmailJS is NOT available - OTP will show as alert');
        return false;
    }
}

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
                {
                    id: 1,
                    name: 'Admin',
                    email: ADMIN_CONFIG.email,
                    password: ADMIN_CONFIG.password,
                    role: 'admin',
                    verified: true
                }
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
        
        console.log('📁 Local data loaded - Users:', users.length, 'Leaves:', leaves.length);
        return true;
    } catch (e) {
        console.warn('⚠️ Error loading data:', e);
        users = [];
        leaves = [];
        return false;
    }
}

function saveData() {
    try {
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('leaves', JSON.stringify(leaves));
        localStorage.setItem('leaveIdCounter', String(leaveIdCounter));
        console.log('💾 Data saved to localStorage - Leaves:', leaves.length);
        
        if (supabaseEnabled && !isSyncing) {
            syncToSupabase();
        }
    } catch (e) {
        console.warn('⚠️ Error saving data:', e);
    }
}

// ============================================
// ===== SUPABASE SYNC (FIXED) =====
// ============================================
async function syncToSupabase() {
    if (!supabaseEnabled || isSyncing || !supabaseClient) {
        console.log('ℹ️ Supabase not ready, skipping sync');
        return;
    }
    
    try {
        isSyncing = true;
        console.log('🔄 Syncing to Supabase...');
        console.log('📤 Users to sync:', users.length);
        console.log('📤 Leaves to sync:', leaves.length);
        
        // Sync users
        for (const user of users) {
            const { error } = await supabaseClient
                .from('users')
                .upsert(user, { onConflict: 'id' });
            if (error) console.error('Error syncing user:', error);
        }
        
        // Sync leaves
        for (const leave of leaves) {
            const { error } = await supabaseClient
                .from('leaves')
                .upsert(leave, { onConflict: 'id' });
            if (error) console.error('Error syncing leave:', error);
        }
        
        console.log('✅ Synced to Supabase successfully');
        return true;
    } catch (e) {
        console.log('⚠️ Supabase sync failed:', e);
        return false;
    } finally {
        isSyncing = false;
    }
}

async function loadFromSupabase() {
    if (!supabaseEnabled || !supabaseClient) {
        console.log('ℹ️ Supabase not ready, skipping load');
        return false;
    }
    
    try {
        console.log('🔄 Loading from Supabase...');
        
        // Load users from Supabase
        const { data: usersData, error: usersError } = await supabaseClient
            .from('users')
            .select('*')
            .order('id', { ascending: true });
        
        if (usersError) {
            console.error('❌ Users load error:', usersError);
            throw usersError;
        }
        
        // Load leaves from Supabase
        const { data: leavesData, error: leavesError } = await supabaseClient
            .from('leaves')
            .select('*')
            .order('id', { ascending: true });
        
        if (leavesError) {
            console.error('❌ Leaves load error:', leavesError);
            throw leavesError;
        }
        
        console.log('📥 Supabase has - Users:', usersData ? usersData.length : 0, 'Leaves:', leavesData ? leavesData.length : 0);
        
        let dataUpdated = false;
        
        // --- MERGE LEAVES (KEEP BOTH LOCAL AND SUPABASE) ---
        if (leavesData && leavesData.length > 0) {
            // Create a map of existing leaf IDs
            const existingLeafIds = new Set(leaves.map(l => l.id));
            
            // Add any leaves from Supabase that don't exist locally
            for (const sl of leavesData) {
                if (!existingLeafIds.has(sl.id)) {
                    leaves.push(sl);
                    dataUpdated = true;
                    console.log('📥 New leave from Supabase:', sl.type, '-', sl.employeeName);
                } else {
                    // Update existing leaf with Supabase data (status might have changed)
                    const localLeaf = leaves.find(l => l.id === sl.id);
                    if (localLeaf && localLeaf.status !== sl.status) {
                        localLeaf.status = sl.status;
                        dataUpdated = true;
                        console.log('🔄 Updated leave status:', sl.id, '->', sl.status);
                    }
                }
            }
        }
        
        // --- MERGE USERS ---
        if (usersData && usersData.length > 0) {
            const existingUserIds = new Set(users.map(u => u.id));
            
            for (const su of usersData) {
                if (!existingUserIds.has(su.id)) {
                    users.push(su);
                    dataUpdated = true;
                    console.log('📥 New user from Supabase:', su.name);
                }
            }
        }
        
        if (dataUpdated) {
            localStorage.setItem('users', JSON.stringify(users));
            localStorage.setItem('leaves', JSON.stringify(leaves));
            console.log('✅ Data merged from Supabase - Users:', users.length, 'Leaves:', leaves.length);
            
            if (currentUserRole === 'admin') {
                renderAdminDashboard();
                renderAdminUsers();
            } else if (currentUser) {
                renderEmployeeDashboard();
            }
            return true;
        } else {
            console.log('✅ No new data from Supabase');
            return false;
        }
    } catch (e) {
        console.log('⚠️ Failed to load from Supabase:', e);
        return false;
    }
}

// ============================================
// ===== FORCE SYNC AND CLEAR =====
// ============================================
async function forceSyncData() {
    if (!supabaseEnabled || !supabaseClient) {
        showToast('❌ Supabase not connected!', 'error');
        return;
    }
    
    showToast('🔄 Forcing sync...', 'success');
    const success = await syncToSupabase();
    if (success) {
        showToast('✅ Data forced synced to cloud!', 'success');
    } else {
        showToast('❌ Sync failed! Check console.', 'error');
    }
}

// ============================================
// ===== DEBUG FUNCTION (FIXED) =====
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

💡 Click "🔄 Refresh Data" to load from Supabase
💡 Click "⚡ Force Sync" to push local data to Supabase
    `;
}

// ============================================
// ===== AUTO-REFRESH =====
// ============================================
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(async () => {
        if (supabaseEnabled && supabaseClient && (currentUserRole === 'admin' || currentUser)) {
            console.log('🔄 Auto-refreshing data...');
            await loadFromSupabase();
        }
    }, 5000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// ============================================
// ===== OTP FUNCTIONS =====
// ============================================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOTP(email, otp) {
    otpStorage[email] = {
        otp: otp,
        timestamp: Date.now()
    };
    
    console.log(`📧 OTP for ${email}: ${otp}`);
    
    if (typeof emailjs !== 'undefined' && emailjs.send) {
        console.log('📧 Sending OTP via EmailJS...');
        
        emailjs.send(
            'service_d41vznp',
            'template_3c6botb',
            {
                to_email: email,
                otp_code: otp,
                subject: 'Your OTP for IIITM Leave Portal'
            }
        )
        .then(function(response) {
            console.log('✅ OTP email sent successfully!', response.status, response.text);
            alert(`✅ OTP sent to ${email}! Please check your inbox.`);
        })
        .catch(function(error) {
            console.log('❌ EmailJS error:', error);
            alert(`⚠️ OTP for ${email}: ${otp}\n\n(Email send failed. Use this OTP to verify.)`);
        });
    } else {
        console.warn('⚠️ EmailJS not available - showing OTP in alert');
        alert(`⚠️ OTP for ${email}: ${otp}\n\n(Email service not available. Use this OTP to verify.)`);
    }
}

function verifyOTP(email, otpInput) {
    const stored = otpStorage[email];
    if (!stored) {
        return { valid: false, message: 'No OTP found. Please request a new one.' };
    }
    if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
        delete otpStorage[email];
        return { valid: false, message: 'OTP expired. Please request a new one.' };
    }
    if (stored.otp === otpInput) {
        delete otpStorage[email];
        return { valid: true, message: 'OTP verified successfully!' };
    }
    return { valid: false, message: 'Invalid OTP. Please try again.' };
}

// ============================================
// ===== SIMPLIFIED CAPTCHA =====
// ============================================
function loadRecaptcha() {
    console.log('ℹ️ reCAPTCHA disabled');
}

function verifyCaptcha(action = 'login') {
    return new Promise((resolve) => {
        console.log('ℹ️ CAPTCHA skipped - always passes');
        resolve(true);
    });
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
    
    document.querySelectorAll('#adminNavLinks a').forEach(a => a.classList.remove('active'));
    const navMap = {
        'adminViewDashboard': 'adminNavDashboard',
        'adminViewUsers': 'adminNavUsers'
    };
    const navId = navMap[viewId];
    if (navId) {
        const navLink = document.getElementById(navId);
        if (navLink) navLink.classList.add('active');
    }
    
    loadDataAndRefresh(viewId);
}

function showEmployeeView(viewId) {
    document.querySelectorAll('#employeeDashboard .view-section').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    
    document.querySelectorAll('#employeeNavLinks a').forEach(a => a.classList.remove('active'));
    const navMap = {
        'empViewDashboard': 'empNavDashboard',
        'empViewApplyLeave': 'empNavApplyLeave',
        'empViewHistory': 'empNavHistory'
    };
    const navId = navMap[viewId];
    if (navId) {
        const navLink = document.getElementById(navId);
        if (navLink) navLink.classList.add('active');
    }
    
    loadDataAndRefresh(viewId);
}

// ============================================
// ===== LOAD DATA AND REFRESH VIEW =====
// ============================================
async function loadDataAndRefresh(viewId) {
    loadData();
    
    if (supabaseEnabled && supabaseClient) {
        await loadFromSupabase();
    }
    
    if (viewId === 'adminViewDashboard') renderAdminDashboard();
    else if (viewId === 'adminViewUsers') renderAdminUsers();
    else if (viewId === 'empViewDashboard') renderEmployeeDashboard();
    else if (viewId === 'empViewHistory') renderEmployeeHistory();
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
                    ` : `<span style="color: #6B6B8A; font-size: 0.85rem;">${l.status}</span>`}
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
// ===== LEAVE ACTIONS =====
// ============================================
async function approveLeave(id) {
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    leave.status = 'Approved';
    saveData();
    
    if (supabaseEnabled) {
        await syncToSupabase();
    }
    
    renderAdminDashboard();
    renderAdminUsers();
    showToast('✅ Leave request approved!', 'success');
}

async function rejectLeave(id) {
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    leave.status = 'Rejected';
    saveData();
    
    if (supabaseEnabled) {
        await syncToSupabase();
    }
    
    renderAdminDashboard();
    renderAdminUsers();
    showToast('❌ Leave request rejected.', 'error');
}

// ============================================
// ===== DELETE USER =====
// ============================================
async function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (user.role === 'admin') {
        showToast('❌ Cannot delete admin user.', 'error');
        return;
    }
    
    if (!confirm(`⚠️ Are you sure you want to delete ${user.name}?\n\nThis will permanently remove:\n• ${user.name}'s account\n• All their leave records\n\nThis action cannot be undone!`)) {
        return;
    }
    
    leaves = leaves.filter(l => l.employeeEmail !== user.email);
    users = users.filter(u => u.id !== userId);
    
    if (supabaseEnabled && supabaseClient) {
        try {
            await supabaseClient
                .from('users')
                .delete()
                .eq('id', userId);
            
            await supabaseClient
                .from('leaves')
                .delete()
                .eq('employeeEmail', user.email);
            
            console.log('✅ User deleted from Supabase');
        } catch (e) {
            console.error('Error deleting from Supabase:', e);
        }
    }
    
    saveData();
    renderAdminDashboard();
    renderAdminUsers();
    showToast(`✅ User "${user.name}" and all their records have been deleted.`, 'success');
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
document.getElementById('gotoAdminLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('adminLoginPage');
});

document.getElementById('gotoEmployeeLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('employeeLoginPage');
});

document.getElementById('gotoRegister').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('registerPage');
});

document.getElementById('adminBackToLanding').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('landingPage');
});

document.getElementById('employeeBackToLanding').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('landingPage');
});

document.getElementById('registerBackToLanding').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('landingPage');
});

// ============================================
// ===== ADMIN LOGIN =====
// ============================================
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const errorEl = document.getElementById('adminLoginError');
    
    if (email !== ADMIN_CONFIG.email || password !== ADMIN_CONFIG.password) {
        errorEl.textContent = '❌ Invalid admin credentials. Please try again.';
        return;
    }
    
    try {
        await verifyCaptcha('admin_login');
    } catch (error) {
        console.warn('⚠️ CAPTCHA error, continuing login');
    }
    
    errorEl.textContent = '';
    currentUserRole = 'admin';
    document.getElementById('adminLoginPage').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    
    await loadFromSupabase();
    showAdminView('adminViewDashboard');
    startAutoRefresh();
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
        errorEl.textContent = '❌ Email not verified. Please verify your email first.';
        return;
    }
    
    try {
        await verifyCaptcha('employee_login');
    } catch (error) {
        console.warn('⚠️ CAPTCHA error, continuing login');
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
    startAutoRefresh();
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
        errorEl.textContent = '❌ Email already registered. Please login.';
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
        const errorEl = document.getElementById('registerError');
        errorEl.textContent = '📧 New OTP sent! Please check your email.';
        errorEl.style.color = '#50C878';
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
    
    const maxId = users.reduce((max, u) => Math.max(max, u.id), 0);
    const newUser = {
        id: maxId + 1,
        name: registrationData.name,
        email: registrationData.email,
        password: registrationData.password,
        role: 'employee',
        verified: true
    };
    
    users.push(newUser);
    saveData();
    
    errorEl.textContent = '✅ Account created and verified! Please login as employee.';
    errorEl.style.color = '#50C878';
    
    document.getElementById('registerForm').reset();
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('otpSection').style.display = 'none';
    document.getElementById('otpInput').value = '';
    document.getElementById('employeeEmail').value = newUser.email;
    document.getElementById('employeePassword').value = newUser.password;
    
    showToast('✅ Account created successfully! Please login.', 'success');
    setTimeout(() => {
        errorEl.textContent = '';
    }, 5000);
});

// ============================================
// ===== NAVIGATION EVENTS =====
// ============================================
document.getElementById('adminNavDashboard').addEventListener('click', (e) => {
    e.preventDefault();
    showAdminView('adminViewDashboard');
});

document.getElementById('adminNavUsers').addEventListener('click', (e) => {
    e.preventDefault();
    showAdminView('adminViewUsers');
});

document.getElementById('adminNavLogout').addEventListener('click', (e) => {
    e.preventDefault();
    stopAutoRefresh();
    currentUserRole = null;
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('adminLoginForm').reset();
    document.getElementById('adminLoginError').textContent = '';
    showPage('landingPage');
});

document.getElementById('empNavDashboard').addEventListener('click', (e) => {
    e.preventDefault();
    showEmployeeView('empViewDashboard');
});

document.getElementById('empNavApplyLeave').addEventListener('click', (e) => {
    e.preventDefault();
    showEmployeeView('empViewApplyLeave');
});

document.getElementById('empNavHistory').addEventListener('click', (e) => {
    e.preventDefault();
    showEmployeeView('empViewHistory');
});

document.getElementById('empNavLogout').addEventListener('click', (e) => {
    e.preventDefault();
    stopAutoRefresh();
    currentUser = null;
    currentUserRole = null;
    document.getElementById('employeeDashboard').style.display = 'none';
    document.getElementById('employeeLoginForm').reset();
    document.getElementById('employeeLoginError').textContent = '';
    showPage('landingPage');
});

document.getElementById('empQuickApplyBtn').addEventListener('click', () => {
    showEmployeeView('empViewApplyLeave');
});

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
        messageEl.textContent = '❌ Please fill in all required fields.';
        messageEl.className = 'form-message error';
        return;
    }
    if (days <= 0) {
        messageEl.textContent = '❌ Number of days must be greater than 0.';
        messageEl.className = 'form-message error';
        return;
    }
    const remaining = getRemainingLeave(currentUser.email);
    if (days > remaining) {
        messageEl.textContent = `❌ You only have ${remaining} days of leave remaining.`;
        messageEl.className = 'form-message error';
        return;
    }
    if (new Date(startDate) > new Date(endDate)) {
        messageEl.textContent = '❌ Start date must be before end date.';
        messageEl.className = 'form-message error';
        return;
    }
    
    const maxId = leaves.reduce((max, l) => Math.max(max, l.id), 0);
    const leave = {
        id: maxId + 1,
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
    console.log('📝 Leave added to local array:', leave);
    
    // Save to localStorage
    try {
        localStorage.setItem('leaves', JSON.stringify(leaves));
        localStorage.setItem('leaveIdCounter', String(leaveIdCounter));
        console.log('💾 Leaves saved to localStorage:', leaves.length);
    } catch (e) {
        console.error('❌ Error saving to localStorage:', e);
    }
    
    // Sync to Supabase
    if (supabaseEnabled) {
        setTimeout(() => {
            syncToSupabase();
        }, 500);
    }
    
    messageEl.textContent = '✅ Leave request submitted successfully! Waiting for approval.';
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
// ===== REFRESH DATA (Manual trigger) =====
// ============================================
async function refreshData() {
    showToast('🔄 Refreshing data...', 'success');
    
    if (supabaseEnabled && supabaseClient) {
        await loadFromSupabase();
    } else {
        loadData();
    }
    
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
// ===== INIT =====
// ============================================
loadData();
loadEmployeeCredentials();

setTimeout(() => {
    checkEmailJS();
}, 1500);

setTimeout(async () => {
    if (supabaseEnabled && supabaseClient) {
        await loadFromSupabase();
        await syncToSupabase();
    }
    if (currentUserRole === 'admin') {
        renderAdminDashboard();
        renderAdminUsers();
        startAutoRefresh();
    } else if (currentUser) {
        renderEmployeeDashboard();
        renderEmployeeHistory();
        startAutoRefresh();
    }
}, 3000);

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    if (startDate) startDate.setAttribute('min', today);
    if (endDate) endDate.setAttribute('min', today);
});

console.log('🏛️ IIITM Leave Portal loaded successfully!');
console.log('👤 Admin:', ADMIN_CONFIG.email);
console.log('📝 Allowed domains:', ALLOWED_DOMAINS.join(', '));
console.log('🔗 Supabase:', supabaseEnabled ? '✅ Connected' : '❌ Not connected (using localStorage only)');
console.log('📧 EmailJS:', typeof emailjs !== 'undefined' ? '✅ Loaded' : '❌ Not loaded');
console.log('🔄 Auto-refresh: Every 5 seconds');
console.log('💡 To refresh data manually, type refreshData() in console');
console.log('🐛 To debug data, type debugShowData() in console');
