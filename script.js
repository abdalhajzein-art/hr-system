'use strict';

// ============================================================
// 1. الإعدادات الافتراضية والتهيئة
// ============================================================

const DEFAULT_SETTINGS = {
    companyName: 'شركة الأثير',
    workDays: [1, 2, 3, 4, 5],
    currency: 'SAR',
    dateFormat: 'DD/MM/YYYY',
    defaultLeaveBalance: 21,
    departments: ['تقنية المعلومات', 'الموارد البشرية', 'المالية', 'التسويق', 'العمليات'],
    jobTitles: ['مدير', 'مشرف', 'مطور برمجيات', 'محاسب', 'أخصائي HR', 'مندوب مبيعات'],
    leaveTypes: [
        { name: 'سنوية', deduct: true },
        { name: 'مرضية', deduct: false },
        { name: 'طارئة', deduct: true }
    ]
};

const DEFAULT_USERS = [
    { id: 1, username: 'admin', password: btoa('admin'), role: 'Admin', empId: null },
    { id: 2, username: 'hr', password: btoa('123456'), role: 'HR', empId: null },
    { id: 3, username: 'sup', password: btoa('123456'), role: 'Supervisor', empId: null },
    { id: 4, username: 'emp', password: btoa('123456'), role: 'Employee', empId: null }
];

const DEFAULT_EMPLOYEES = [
    { id: 1, name: 'أحمد محمد', email: 'hr@system.com', dept: 'الموارد البشرية', job: 'أخصائي HR', salary: 8000,
        leaveBalance: 21, status: 'نشط' },
    { id: 2, name: 'خالد علي', email: 'sup@system.com', dept: 'تقنية المعلومات', job: 'مطور برمجيات', salary: 12000,
        leaveBalance: 15, status: 'نشط' },
    { id: 3, name: 'سارة أحمد', email: 'emp@system.com', dept: 'تقنية المعلومات', job: 'مطور برمجيات', salary: 10000,
        leaveBalance: 18, status: 'نشط' },
    { id: 4, name: 'محمد عمر', email: 'mohamed@system.com', dept: 'المالية', job: 'محاسب', salary: 9000,
        leaveBalance: 20, status: 'نشط' },
    { id: 5, name: 'فاطمة حسن', email: 'fatima@system.com', dept: 'التسويق', job: 'مدير مبيعات', salary: 11000,
        leaveBalance: 14, status: 'في إجازة' }
];

const DEFAULT_LEAVES = [
    { id: 1, empId: 3, type: 'سنوية', from: '2026-09-01', to: '2026-09-05', days: 5, status: 'معلق' },
    { id: 2, empId: 1, type: 'مرضية', from: '2026-09-10', to: '2026-09-11', days: 2, status: 'موافق' }
];

const DEFAULT_ATTENDANCE = [];

// ============================================================
// 2. دوال التخزين
// ============================================================

function getData(key) {
    try {
        const data = localStorage.getItem('hr_' + key);
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function setData(key, value) {
    try {
        localStorage.setItem('hr_' + key, JSON.stringify(value));
    } catch (e) { /* ignore */ }
}

function initStorage() {
    if (!getData('settings')) setData('settings', DEFAULT_SETTINGS);
    if (!getData('users')) setData('users', DEFAULT_USERS);
    if (!getData('employees')) setData('employees', DEFAULT_EMPLOYEES);
    if (!getData('leaves')) setData('leaves', DEFAULT_LEAVES);
    if (!getData('attendance')) setData('attendance', DEFAULT_ATTENDANCE);
    if (!getData('payroll')) setData('payroll', []);
    if (!getData('audit')) setData('audit', []);
}

// ============================================================
// 3. الحالة العامة
// ============================================================

let currentUser = null;
let currentPage = 'dashboard';
const ITEMS_PER_PAGE = 10;
const pagination = {
    employees: 1,
    attendance: 1,
    leaves: 1,
    payroll: 1,
    audit: 1
};

// ============================================================
// 4. دوال مساعدة
// ============================================================

function encrypt(pass) {
    return btoa(encodeURIComponent(pass));
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const fmt = getData('settings')?.dateFormat || 'DD/MM/YYYY';
    if (fmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
    if (fmt === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`;
}

function getWorkingDays() {
    return getData('settings')?.workDays || [1, 2, 3, 4, 5];
}

function isWorkDay(date) {
    const day = new Date(date).getDay();
    return getWorkingDays().includes(day);
}

function calcWorkDays(from, to) {
    const start = new Date(from);
    const end = new Date(to);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (isWorkDay(d)) count++;
    }
    return count;
}

function calcWorkDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        if (isWorkDay(d)) count++;
    }
    return count;
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <span class="toast-msg">${msg}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutLeft 0.3s forwards';
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

function logAudit(action, details = '') {
    const audit = getData('audit') || [];
    audit.unshift({
        user: currentUser?.username || 'System',
        action,
        details,
        date: new Date().toISOString()
    });
    setData('audit', audit);
}

function openModal(id) {
    document.getElementById(id).classList.add('show');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('show');
    });
});

// ============================================================
// 5. المصادقة
// ============================================================

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login-email').value.trim();
    const password = encrypt(document.getElementById('login-password').value);
    const users = getData('users') || [];

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        sessionStorage.setItem('hr_user', JSON.stringify(user));
        logAudit('تسجيل دخول', `دخول ناجح للمستخدم ${username}`);
        startApp();
    } else {
        showToast('بيانات الدخول غير صحيحة', 'error');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    logAudit('تسجيل خروج', `خروج المستخدم ${currentUser?.username}`);
    sessionStorage.removeItem('hr_user');
    location.reload();
});

function checkSession() {
    const saved = sessionStorage.getItem('hr_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            return true;
        } catch (e) { return false; }
    }
    return false;
}

// ============================================================
// 6. تشغيل التطبيق
// ============================================================

function startApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    document.getElementById('user-display').textContent = currentUser.username;
    document.getElementById('user-role-badge').textContent = currentUser.role;
    document.getElementById('user-avatar').textContent = currentUser.username.charAt(0).toUpperCase();

    const role = currentUser.role;
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = role === 'Admin' ? '' : 'none';
    });
    document.querySelectorAll('.admin-only-tab').forEach(el => {
        el.style.display = role === 'Admin' ? '' : 'none';
    });
    document.querySelectorAll('.admin-hr-only').forEach(el => {
        el.style.display = (role === 'Admin' || role === 'HR') ? '' : 'none';
    });
    document.querySelectorAll('.admin-hr-only-tab').forEach(el => {
        el.style.display = (role === 'Admin' || role === 'HR') ? '' : 'none';
    });

    initNavigation();
    loadDashboard();
    renderEmployees();
    renderAttendance();
    renderLeaves();
    renderPayroll();
    renderUsers();
    renderAudit();
    loadSettings();
    populateSelects();

    document.getElementById('att-filter-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('payroll-month').value = new Date().toISOString().slice(0, 7);
    document.getElementById('att-emp-date').value = new Date().toISOString().split('T')[0];
}

// ============================================================
// 7. التنقل
// ============================================================

function initNavigation() {
    const links = document.querySelectorAll('.nav-link[data-target]');
    links.forEach(link => {
        link.addEventListener('click', () => {
            const target = link.dataset.target;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const tab = document.getElementById(target);
            if (tab) tab.classList.add('active');

            currentPage = target;

            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }

            if (target === 'dashboard') loadDashboard();
            if (target === 'employees') renderEmployees();
            if (target === 'attendance') renderAttendance();
            if (target === 'leaves') renderLeaves();
            if (target === 'payroll') renderPayroll();
            if (target === 'users') renderUsers();
            if (target === 'audit') renderAudit();
            if (target === 'settings') loadSettings();
        });
    });

    document.getElementById('hamburger-btn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('emp-search').addEventListener('input', debounce(() => {
        pagination.employees = 1;
        renderEmployees();
    }, 300));

    document.getElementById('emp-filter-dept').addEventListener('change', () => {
        pagination.employees = 1;
        renderEmployees();
    });
    document.getElementById('emp-filter-status').addEventListener('change', () => {
        pagination.employees = 1;
        renderEmployees();
    });

    document.getElementById('att-filter-date').addEventListener('change', () => {
        pagination.attendance = 1;
        renderAttendance();
    });
    document.getElementById('att-filter-status').addEventListener('change', () => {
        pagination.attendance = 1;
        renderAttendance();
    });
    document.getElementById('att-filter-emp').addEventListener('change', () => {
        pagination.attendance = 1;
        renderAttendance();
    });

    document.getElementById('payroll-month').addEventListener('change', () => {
        renderPayroll();
    });
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ============================================================
// 8. لوحة التحكم
// ============================================================

function loadDashboard() {
    const emps = getData('employees') || [];
    const leaves = getData('leaves') || [];
    const atts = getData('attendance') || [];
    const today = new Date().toISOString().split('T')[0];

    document.getElementById('kpi-total-emp').textContent = emps.length;
    document.getElementById('kpi-active-emp').textContent = emps.filter(e => e.status === 'نشط').length;
    document.getElementById('kpi-today-attendance').textContent = atts.filter(a => a.date === today && a.status !== 'غائب')
        .length;
    document.getElementById('kpi-pending-leaves').textContent = leaves.filter(l => l.status === 'معلق').length;

    document.getElementById('emp-count-badge').textContent = emps.length;
    document.getElementById('leave-pending-badge').textContent = leaves.filter(l => l.status === 'معلق').length;
}

// ============================================================
// 9. إدارة الموظفين
// ============================================================

function renderEmployees() {
    const tbody = document.getElementById('employees-tbody');
    let emps = getData('employees') || [];
    const settings = getData('settings') || DEFAULT_SETTINGS;
    const search = document.getElementById('emp-search').value.toLowerCase();
    const deptFilter = document.getElementById('emp-filter-dept').value;
    const statusFilter = document.getElementById('emp-filter-status').value;

    if (currentUser.role === 'Supervisor') {
        const myEmp = emps.find(e => e.email === currentUser.username);
        if (myEmp) {
            emps = emps.filter(e => e.dept === myEmp.dept);
        }
    }

    let filtered = emps.filter(e => {
        const matchSearch = e.name.toLowerCase().includes(search) || e.email.toLowerCase().includes(search);
        const matchDept = !deptFilter || e.dept === deptFilter;
        const matchStatus = !statusFilter || e.status === statusFilter;
        return matchSearch && matchDept && matchStatus;
    });

    const page = pagination.employees;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);

    const fragment = document.createDocumentFragment();
    paginated.forEach(emp => {
        const tr = document.createElement('tr');
        const statusClass = emp.status === 'نشط' ? 'badge-success' : (emp.status === 'في إجازة' ? 'badge-warning' :
            'badge-danger');
        tr.innerHTML = `
                    <td><strong>${emp.name}</strong></td>
                    <td>${emp.email}</td>
                    <td><span class="dept-tag">${emp.dept}</span></td>
                    <td>${emp.job}</td>
                    <td>${emp.salary} ${settings.currency}</td>
                    <td style="color: ${emp.leaveBalance < 5 ? 'var(--danger)' : 'var(--text-main)'}">${emp.leaveBalance}</td>
                    <td><span class="badge ${statusClass}">${emp.status}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn action-btn-edit" onclick="editEmployee(${emp.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                            ${currentUser.role === 'Admin' ? `<button class="action-btn action-btn-delete" onclick="deleteEmployee(${emp.id})" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                `;
        fragment.appendChild(tr);
    });

    requestAnimationFrame(() => {
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        renderPagination('employees-pagination', filtered.length, page, (p) => {
            pagination.employees = p;
            renderEmployees();
        });
    });
}

function populateSelects() {
    const settings = getData('settings') || DEFAULT_SETTINGS;

    const deptSelects = ['emp-dept', 'emp-filter-dept'];
    deptSelects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = id === 'emp-filter-dept' ? '<option value="">جميع الأقسام</option>' : '';
        settings.departments.forEach(d => {
            el.innerHTML += `<option value="${d}" ${d === current ? 'selected' : ''}>${d}</option>`;
        });
    });

    const jobSelect = document.getElementById('emp-job');
    if (jobSelect) {
        const current = jobSelect.value;
        jobSelect.innerHTML = '';
        settings.jobTitles.forEach(j => {
            jobSelect.innerHTML += `<option value="${j}" ${j === current ? 'selected' : ''}>${j}</option>`;
        });
    }

    const leaveSelect = document.getElementById('leave-type');
    if (leaveSelect) {
        const current = leaveSelect.value;
        leaveSelect.innerHTML = '';
        settings.leaveTypes.forEach(l => {
            leaveSelect.innerHTML +=
                `<option value="${l.name}" ${l.name === current ? 'selected' : ''}>${l.name}</option>`;
        });
    }

    const emps = getData('employees') || [];
    ['leave-emp', 'user-emp-link', 'att-emp-select', 'att-filter-emp'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        const isFilter = id === 'att-filter-emp';
        el.innerHTML = isFilter ? '<option value="">جميع الموظفين</option>' : (id === 'leave-emp' ?
            '<option value="">اختر الموظف</option>' : '<option value="">-- بدون --</option>');
        emps.forEach(e => {
            el.innerHTML += `<option value="${e.id}" ${e.id == current ? 'selected' : ''}>${e.name}</option>`;
        });
    });
}

document.getElementById('employee-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('emp-id').value;
    const emp = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('emp-name').value.trim(),
        email: document.getElementById('emp-email').value.trim(),
        dept: document.getElementById('emp-dept').value,
        job: document.getElementById('emp-job').value,
        salary: parseFloat(document.getElementById('emp-salary').value) || 0,
        leaveBalance: parseInt(document.getElementById('emp-leave-balance').value) || 21,
        status: document.getElementById('emp-status').value
    };

    let emps = getData('employees') || [];
    let users = getData('users') || [];

    if (id) {
        const idx = emps.findIndex(e => e.id == id);
        if (idx !== -1) emps[idx] = emp;
        logAudit('تعديل موظف', `تعديل بيانات الموظف ${emp.name}`);
        showToast('تم تعديل الموظف بنجاح');
    } else {
        emps.push(emp);
        if (!users.some(u => u.username === emp.email)) {
            users.push({
                id: Date.now(),
                username: emp.email,
                password: encrypt('123456'),
                role: 'Employee',
                empId: emp.id
            });
            setData('users', users);
            logAudit('إضافة موظف', `إضافة موظف جديد ${emp.name} مع حساب مستخدم`);
        } else {
            logAudit('إضافة موظف', `إضافة موظف جديد ${emp.name}`);
        }
        showToast('تمت إضافة الموظف وحساب المستخدم بنجاح');
    }

    setData('employees', emps);
    closeModal('employee-modal');
    populateSelects();
    renderEmployees();
    loadDashboard();
    document.getElementById('employee-form').reset();
    document.getElementById('emp-id').value = '';
});

function editEmployee(id) {
    const emps = getData('employees') || [];
    const emp = emps.find(e => e.id == id);
    if (!emp) return;

    document.getElementById('emp-id').value = emp.id;
    document.getElementById('emp-name').value = emp.name;
    document.getElementById('emp-email').value = emp.email;
    document.getElementById('emp-dept').value = emp.dept;
    document.getElementById('emp-job').value = emp.job;
    document.getElementById('emp-salary').value = emp.salary;
    document.getElementById('emp-leave-balance').value = emp.leaveBalance;
    document.getElementById('emp-status').value = emp.status;
    document.getElementById('emp-modal-title').textContent = 'تعديل موظف';
    openModal('employee-modal');
}

function deleteEmployee(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
    let emps = getData('employees') || [];
    const emp = emps.find(e => e.id == id);
    emps = emps.filter(e => e.id != id);
    setData('employees', emps);
    logAudit('حذف موظف', `حذف الموظف ${emp?.name}`);
    showToast('تم حذف الموظف');
    renderEmployees();
    loadDashboard();
    populateSelects();
}

// ============================================================
// 10. الحضور والانصراف - مع تحكم كامل للمدير
// ============================================================

function renderAttendance() {
    const tbody = document.getElementById('attendance-tbody');
    let atts = getData('attendance') || [];
    const emps = getData('employees') || [];
    const filterDate = document.getElementById('att-filter-date').value || new Date().toISOString().split('T')[0];
    const filterStatus = document.getElementById('att-filter-status').value;
    const filterEmp = parseInt(document.getElementById('att-filter-emp').value) || null;

    if (currentUser.role === 'Employee') {
        const myEmp = emps.find(e => e.email === currentUser.username);
        if (myEmp) atts = atts.filter(a => a.empId === myEmp.id);
    } else if (currentUser.role === 'Supervisor') {
        const myEmp = emps.find(e => e.email === currentUser.username);
        if (myEmp) {
            const deptEmps = emps.filter(e => e.dept === myEmp.dept).map(e => e.id);
            atts = atts.filter(a => deptEmps.includes(a.empId));
        }
    }

    let filtered = atts.filter(a => {
        const matchDate = a.date === filterDate;
        const matchStatus = !filterStatus || a.status === filterStatus;
        const matchEmp = !filterEmp || a.empId === filterEmp;
        return matchDate && matchStatus && matchEmp;
    });

    const page = pagination.attendance;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);

    const fragment = document.createDocumentFragment();
    paginated.forEach(a => {
        const emp = emps.find(e => e.id === a.empId);
        const statusClass = a.status === 'حاضر' ? 'badge-success' : (a.status === 'متأخر' ? 'badge-warning' :
            'badge-danger');
        const tr = document.createElement('tr');
        const isAdmin = currentUser.role === 'Admin';
        tr.innerHTML = `
                    <td><strong>${emp?.name || 'غير معروف'}</strong></td>
                    <td>${formatDate(a.date)}</td>
                    <td>${a.checkIn || '--'}</td>
                    <td>${a.checkOut || '--'}</td>
                    <td>${a.hours || 0}</td>
                    <td><span class="badge ${statusClass}">${a.status || 'غائب'}</span></td>
                    <td>
                        <div class="action-btns">
                            ${isAdmin ? `<button class="action-btn action-btn-edit" onclick="editAttendance(${a.id})" title="تعديل"><i class="fas fa-edit"></i></button>` : ''}
                            ${isAdmin ? `<button class="action-btn action-btn-delete" onclick="deleteAttendance(${a.id})" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                `;
        fragment.appendChild(tr);
    });

    requestAnimationFrame(() => {
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        renderPagination('attendance-pagination', filtered.length, page, (p) => {
            pagination.attendance = p;
            renderAttendance();
        });
    });
}

// تسجيل دخول/انصراف للموظف الحالي
function recordMyAttendance(type) {
    if (currentUser.role === 'Admin' || currentUser.role === 'HR') {
        showToast('⚠️ يمكن للموظفين فقط تسجيل الحضور لأنفسهم', 'warning');
        return;
    }

    const emps = getData('employees') || [];
    const myEmp = emps.find(e => e.email === currentUser.username);
    if (!myEmp) {
        showToast('⚠️ لا يوجد ملف موظف مرتبط بحسابك', 'error');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    let atts = getData('attendance') || [];
    let existing = atts.find(a => a.empId === myEmp.id && a.date === today);

    if (type === 'in') {
        if (existing?.checkIn) {
            showToast('⚠️ تم تسجيل الدخول مسبقاً اليوم', 'warning');
            return;
        }
        const settings = getData('settings') || DEFAULT_SETTINGS;
        const workStart = settings.workStart || '09:00';
        const status = time > workStart ? 'متأخر' : 'حاضر';

        if (!existing) {
            atts.push({
                id: Date.now(),
                empId: myEmp.id,
                date: today,
                checkIn: time,
                checkOut: null,
                hours: 0,
                status
            });
        } else {
            existing.checkIn = time;
            existing.status = status;
        }
        setData('attendance', atts);
        logAudit('تسجيل دخول', `الموظف ${myEmp.name} سجل دخول الساعة ${time}`);
        showToast(`✅ تم تسجيل الدخول (${status})`);
    } else {
        if (!existing?.checkIn) {
            showToast('⚠️ يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        if (existing.checkOut) {
            showToast('⚠️ تم تسجيل الانصراف مسبقاً', 'warning');
            return;
        }
        existing.checkOut = time;
        const [h1, m1] = existing.checkIn.split(':').map(Number);
        const [h2, m2] = time.split(':').map(Number);
        const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        existing.hours = Math.round(diff / 60 * 10) / 10;
        setData('attendance', atts);
        logAudit('تسجيل انصراف', `الموظف ${myEmp.name} سجل انصراف الساعة ${time}`);
        showToast('✅ تم تسجيل الانصراف');
    }

    renderAttendance();
    loadDashboard();
}

// تسجيل حضور لموظف معين (للمدير فقط)
document.getElementById('attendance-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentUser.role !== 'Admin') {
        showToast('⚠️ فقط المدير يمكنه تسجيل الحضور للموظفين', 'error');
        return;
    }

    const empId = parseInt(document.getElementById('att-emp-select').value);
    const date = document.getElementById('att-emp-date').value;
    const checkIn = document.getElementById('att-emp-in').value;
    const checkOut = document.getElementById('att-emp-out').value;
    const status = document.getElementById('att-emp-status').value;

    if (!empId || !date) {
        showToast('الرجاء اختيار الموظف والتاريخ', 'error');
        return;
    }

    let atts = getData('attendance') || [];
    const existing = atts.find(a => a.empId === empId && a.date === date);

    if (existing) {
        existing.checkIn = checkIn || existing.checkIn;
        existing.checkOut = checkOut || existing.checkOut;
        existing.status = status;
    } else {
        atts.push({
            id: Date.now(),
            empId,
            date,
            checkIn: checkIn || null,
            checkOut: checkOut || null,
            hours: 0,
            status
        });
        // حساب الساعات إذا كان الدخول والخروج موجودين
        if (checkIn && checkOut) {
            const [h1, m1] = checkIn.split(':').map(Number);
            const [h2, m2] = checkOut.split(':').map(Number);
            const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            const last = atts[atts.length - 1];
            if (last) last.hours = Math.round(diff / 60 * 10) / 10;
        }
    }

    setData('attendance', atts);
    const emp = (getData('employees') || []).find(e => e.id === empId);
    logAudit('تسجيل حضور', `تسجيل حضور للموظف ${emp?.name} في ${date}`);
    showToast(`✅ تم تسجيل حضور ${emp?.name}`);
    closeModal('attendance-modal');
    renderAttendance();
    loadDashboard();
});

function editAttendance(id) {
    const atts = getData('attendance') || [];
    const att = atts.find(a => a.id === id);
    if (!att) return;

    const newStatus = prompt('تغيير الحالة (حاضر/متأخر/غائب/إجازة):', att.status);
    if (newStatus) {
        att.status = newStatus;
        setData('attendance', atts);
        logAudit('تعديل حضور', `تعديل حالة الحضور ID: ${id} إلى ${newStatus}`);
        renderAttendance();
        showToast('تم التعديل');
    }
}

function deleteAttendance(id) {
    if (!confirm('حذف سجل الحضور؟')) return;
    let atts = getData('attendance') || [];
    atts = atts.filter(a => a.id !== id);
    setData('attendance', atts);
    logAudit('حذف حضور', `حذف سجل حضور ID: ${id}`);
    renderAttendance();
    showToast('تم الحذف');
}

// ============================================================
// 11. الإجازات
// ============================================================

function renderLeaves() {
    const tbody = document.getElementById('leaves-tbody');
    let leaves = getData('leaves') || [];
    const emps = getData('employees') || [];

    if (currentUser.role === 'Employee') {
        const myEmp = emps.find(e => e.email === currentUser.username);
        if (myEmp) leaves = leaves.filter(l => l.empId === myEmp.id);
    } else if (currentUser.role === 'Supervisor') {
        const myEmp = emps.find(e => e.email === currentUser.username);
        if (myEmp) {
            const deptEmps = emps.filter(e => e.dept === myEmp.dept).map(e => e.id);
            leaves = leaves.filter(l => deptEmps.includes(l.empId));
        }
    }

    const page = pagination.leaves;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const paginated = leaves.slice(start, start + ITEMS_PER_PAGE);

    const fragment = document.createDocumentFragment();
    paginated.forEach(l => {
        const emp = emps.find(e => e.id === l.empId);
        const statusClass = l.status === 'موافق' ? 'badge-success' : (l.status === 'مرفود' ? 'badge-danger' :
            'badge-warning');
        const tr = document.createElement('tr');
        let actions = '';
        if (l.status === 'معلق' && currentUser.role !== 'Employee') {
            actions = `
                        <button class="action-btn action-btn-approve" onclick="approveLeave(${l.id})" title="موافقة"><i class="fas fa-check"></i></button>
                        <button class="action-btn action-btn-reject" onclick="rejectLeave(${l.id})" title="رفض"><i class="fas fa-times"></i></button>
                    `;
        }
        tr.innerHTML = `
                    <td><strong>${emp?.name || 'غير معروف'}</strong></td>
                    <td>${l.type}</td>
                    <td>${formatDate(l.from)}</td>
                    <td>${formatDate(l.to)}</td>
                    <td>${l.days}</td>
                    <td><span class="badge ${statusClass}">${l.status}</span></td>
                    <td><div class="action-btns">${actions}</div></td>
                `;
        fragment.appendChild(tr);
    });

    requestAnimationFrame(() => {
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        renderPagination('leaves-pagination', leaves.length, page, (p) => {
            pagination.leaves = p;
            renderLeaves();
        });
    });
}

function calcLeaveDays() {
    const from = document.getElementById('leave-start').value;
    const to = document.getElementById('leave-end').value;
    if (from && to) {
        const days = calcWorkDays(from, to);
        document.getElementById('leave-days').value = days > 0 ? days : '0';
    }
}

document.getElementById('leave-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const empId = parseInt(document.getElementById('leave-emp').value);
    const type = document.getElementById('leave-type').value;
    const from = document.getElementById('leave-start').value;
    const to = document.getElementById('leave-end').value;
    const days = parseInt(document.getElementById('leave-days').value) || 0;

    if (!empId || !from || !to || days <= 0) {
        showToast('الرجاء إدخال جميع البيانات', 'error');
        return;
    }

    const emps = getData('employees') || [];
    const settings = getData('settings') || DEFAULT_SETTINGS;
    const leaveType = settings.leaveTypes.find(l => l.name === type);
    const emp = emps.find(e => e.id === empId);

    if (leaveType?.deduct && emp && emp.leaveBalance < days) {
        showToast(`⚠️ الرصيد غير كافٍ! المتبقي: ${emp.leaveBalance} يوم`, 'error');
        return;
    }

    const leaves = getData('leaves') || [];
    leaves.push({
        id: Date.now(),
        empId,
        type,
        from,
        to,
        days,
        status: 'معلق'
    });
    setData('leaves', leaves);
    logAudit('طلب إجازة', `طلب إجازة ${type} للموظف ID: ${empId}`);
    showToast('✅ تم إرسال طلب الإجازة');
    closeModal('leave-modal');
    renderLeaves();
    loadDashboard();
});

function approveLeave(id) {
    let leaves = getData('leaves') || [];
    let emps = getData('employees') || [];
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;

    const settings = getData('settings') || DEFAULT_SETTINGS;
    const leaveType = settings.leaveTypes.find(l => l.name === leave.type);

    leave.status = 'موافق';
    if (leaveType?.deduct) {
        const emp = emps.find(e => e.id === leave.empId);
        if (emp) {
            emp.leaveBalance = Math.max(0, emp.leaveBalance - leave.days);
            setData('employees', emps);
        }
    }
    setData('leaves', leaves);
    logAudit('موافقة إجازة', `الموافقة على إجازة ID: ${id}`);
    showToast('✅ تمت الموافقة على الإجازة');
    renderLeaves();
    renderEmployees();
    loadDashboard();
}

function rejectLeave(id) {
    let leaves = getData('leaves') || [];
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    leave.status = 'مرفود';
    setData('leaves', leaves);
    logAudit('رفض إجازة', `رفض إجازة ID: ${id}`);
    showToast('❌ تم رفض الإجازة');
    renderLeaves();
}

// ============================================================
// 12. الرواتب
// ============================================================

function renderPayroll() {
    const tbody = document.getElementById('payroll-tbody');
    let payroll = getData('payroll') || [];
    const emps = getData('employees') || [];
    const settings = getData('settings') || DEFAULT_SETTINGS;
    const month = document.getElementById('payroll-month').value || new Date().toISOString().slice(0, 7);

    if (currentUser.role === 'Employee') {
        const myEmp = emps.find(e => e.email === currentUser.username);
        if (myEmp) payroll = payroll.filter(p => p.empId === myEmp.id);
    } else if (currentUser.role === 'Supervisor') {
        const myEmp = emps.find(e => e.email === currentUser.username);
        if (myEmp) {
            const deptEmps = emps.filter(e => e.dept === myEmp.dept).map(e => e.id);
            payroll = payroll.filter(p => deptEmps.includes(p.empId));
        }
    }

    payroll = payroll.filter(p => p.month === month);

    const page = pagination.payroll;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const paginated = payroll.slice(start, start + ITEMS_PER_PAGE);

    const fragment = document.createDocumentFragment();
    paginated.forEach(p => {
        const emp = emps.find(e => e.id === p.empId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
                    <td><strong>${emp?.name || 'غير معروف'}</strong></td>
                    <td>${p.basic} ${settings.currency}</td>
                    <td>${p.absence}</td>
                    <td style="color: var(--danger)">${p.deduction} ${settings.currency}</td>
                    <td style="color: var(--success)">${p.bonus} ${settings.currency}</td>
                    <td style="font-weight: bold; color: var(--gold)">${p.net} ${settings.currency}</td>
                    <td>
                        <div class="action-btns">
                            ${currentUser.role !== 'Employee' ? `<button class="action-btn action-btn-edit" onclick="editPayroll(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>` : ''}
                            <button class="action-btn action-btn-view" onclick="printPayslip(${p.id})" title="طباعة قسيمة"><i class="fas fa-print"></i></button>
                        </div>
                    </td>
                `;
        fragment.appendChild(tr);
    });

    requestAnimationFrame(() => {
        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        const [year, monthNum] = month.split('-').map(Number);
        document.getElementById('payroll-work-days').textContent = calcWorkDaysInMonth(year, monthNum - 1);

        renderPagination('payroll-pagination', payroll.length, page, (p) => {
            pagination.payroll = p;
            renderPayroll();
        });
    });
}

function generatePayroll() {
    const emps = getData('employees') || [];
    const month = document.getElementById('payroll-month').value || new Date().toISOString().slice(0, 7);
    const [year, monthNum] = month.split('-').map(Number);
    const workDays = calcWorkDaysInMonth(year, monthNum - 1);

    let payroll = getData('payroll') || [];
    payroll = payroll.filter(p => p.month !== month);

    emps.forEach(emp => {
        if (emp.status === 'منتهي الخدمة') return;
        const atts = getData('attendance') || [];
        const empAtts = atts.filter(a => a.empId === emp.id && a.date.startsWith(month));
        const absence = empAtts.filter(a => a.status === 'غائب' || !a.checkIn).length;

        const dailyRate = emp.salary / workDays;
        const deduction = absence * dailyRate;
        const bonus = 0;
        const net = emp.salary - deduction + bonus;

        payroll.push({
            id: Date.now() + Math.random() * 1000,
            empId: emp.id,
            month,
            basic: emp.salary,
            absence,
            deduction: Math.round(deduction * 100) / 100,
            bonus,
            net: Math.round(net * 100) / 100
        });
    });

    setData('payroll', payroll);
    logAudit('توليد رواتب', `توليد رواتب شهر ${month}`);
    showToast(`✅ تم توليد رواتب ${month}`);
    renderPayroll();
}

function editPayroll(id) {
    const payroll = getData('payroll') || [];
    const p = payroll.find(item => item.id === id);
    if (!p) return;

    document.getElementById('payroll-emp-id').value = p.id;
    document.getElementById('payroll-absence').value = p.absence;
    document.getElementById('payroll-bonus').value = p.bonus || 0;
    openModal('payroll-modal');
}

document.getElementById('payroll-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('payroll-emp-id').value);
    const absence = parseInt(document.getElementById('payroll-absence').value) || 0;
    const bonus = parseFloat(document.getElementById('payroll-bonus').value) || 0;

    let payroll = getData('payroll') || [];
    const p = payroll.find(item => item.id === id);
    if (p) {
        const emps = getData('employees') || [];
        const emp = emps.find(e => e.id === p.empId);
        const [year, monthNum] = p.month.split('-').map(Number);
        const workDays = calcWorkDaysInMonth(year, monthNum - 1);
        const dailyRate = emp ? emp.salary / workDays : 0;

        p.absence = absence;
        p.bonus = bonus;
        p.deduction = Math.round(absence * dailyRate * 100) / 100;
        p.net = Math.round((p.basic - p.deduction + bonus) * 100) / 100;
        setData('payroll', payroll);
        logAudit('تعديل راتب', `تعديل راتب ID: ${id}`);
        showToast('✅ تم تحديث الراتب');
        closeModal('payroll-modal');
        renderPayroll();
    }
});

function printPayslip(id) {
    const payroll = getData('payroll') || [];
    const p = payroll.find(item => item.id === id);
    if (!p) return;

    const emps = getData('employees') || [];
    const emp = emps.find(e => e.id === p.empId);
    const settings = getData('settings') || DEFAULT_SETTINGS;

    const content = document.getElementById('payslip-content');
    content.innerHTML = `
                <table style="width:100%; border-collapse:collapse; text-align:right; margin:20px 0;">
                    <tr><td style="padding:10px;"><strong>الموظف:</strong> ${emp?.name || 'غير معروف'}</td>
                        <td style="padding:10px;"><strong>القسم:</strong> ${emp?.dept || '-'}</td></tr>
                    <tr><td style="padding:10px;"><strong>المسمى:</strong> ${emp?.job || '-'}</td>
                        <td style="padding:10px;"><strong>الشهر:</strong> ${p.month}</td></tr>
                </table>
                <table style="width:100%; border-collapse:collapse; text-align:center;" border="1">
                    <tr style="background:#f0f0f0;">
                        <th style="padding:10px; color:#000;">البيان</th>
                        <th style="padding:10px; color:#000;">المبلغ (${settings.currency})</th>
                    </tr>
                    <tr><td style="padding:10px; text-align:right;">الراتب الأساسي</td><td style="padding:10px;">${p.basic}</td></tr>
                    <tr><td style="padding:10px; text-align:right;">أيام الغياب</td><td style="padding:10px;">${p.absence}</td></tr>
                    <tr><td style="padding:10px; text-align:right; color:red;">الخصومات</td><td style="padding:10px; color:red;">${p.deduction}</td></tr>
                    <tr><td style="padding:10px; text-align:right; color:green;">المكافآت</td><td style="padding:10px; color:green;">${p.bonus}</td></tr>
                    <tr style="font-weight:bold; background:#f0f0f0;">
                        <td style="padding:10px; text-align:right;">الصافي المستحق</td>
                        <td style="padding:10px; color:#d4af37;">${p.net}</td>
                    </tr>
                </table>
                <div style="margin-top:30px; display:flex; justify-content:space-between;">
                    <div>توقيع الموظف: _________________</div>
                    <div>توقيع المدير: _________________</div>
                </div>
            `;

    document.getElementById('print-company').textContent = settings.companyName || 'شركة الأثير';
    document.getElementById('payslip-print').style.display = 'block';
    window.print();
    setTimeout(() => {
        document.getElementById('payslip-print').style.display = 'none';
    }, 1000);
}

// ============================================================
// 13. المستخدمون
// ============================================================

function renderUsers() {
    if (currentUser.role !== 'Admin') return;
    const tbody = document.getElementById('users-tbody');
    const users = getData('users') || [];
    const emps = getData('employees') || [];

    const fragment = document.createDocumentFragment();
    users.forEach(u => {
        const emp = emps.find(e => e.id === u.empId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
                    <td><strong>${u.username}</strong></td>
                    <td><span class="badge badge-gold">${u.role}</span></td>
                    <td>${emp?.name || 'غير مربوط'}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn action-btn-edit" onclick="editUser(${u.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                            ${u.id !== currentUser.id ? `<button class="action-btn action-btn-delete" onclick="deleteUser(${u.id})" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                `;
        fragment.appendChild(tr);
    });

    requestAnimationFrame(() => {
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    });
}

document.getElementById('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const empId = document.getElementById('user-emp-link').value;

    let users = getData('users') || [];

    if (id) {
        const user = users.find(u => u.id == id);
        if (user) {
            user.username = username;
            user.role = role;
            user.empId = empId ? parseInt(empId) : null;
            if (password) user.password = encrypt(password);
        }
        logAudit('تعديل مستخدم', `تعديل بيانات المستخدم ${username}`);
        showToast('✅ تم تعديل المستخدم');
    } else {
        if (!password) {
            showToast('⚠️ كلمة المرور مطلوبة للمستخدم الجديد', 'error');
            return;
        }
        users.push({
            id: Date.now(),
            username,
            password: encrypt(password),
            role,
            empId: empId ? parseInt(empId) : null
        });
        logAudit('إضافة مستخدم', `إضافة مستخدم جديد ${username}`);
        showToast('✅ تمت إضافة المستخدم');
    }

    setData('users', users);
    closeModal('user-modal');
    renderUsers();
    populateSelects();
});

function editUser(id) {
    const users = getData('users') || [];
    const user = users.find(u => u.id === id);
    if (!user) return;

    document.getElementById('user-id').value = user.id;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-emp-link').value = user.empId || '';
    document.getElementById('user-modal-title').textContent = 'تعديل مستخدم';
    openModal('user-modal');
}

function deleteUser(id) {
    if (!confirm('حذف المستخدم؟')) return;
    let users = getData('users') || [];
    users = users.filter(u => u.id !== id);
    setData('users', users);
    logAudit('حذف مستخدم', `حذف مستخدم ID: ${id}`);
    renderUsers();
    showToast('تم حذف المستخدم');
}

// ============================================================
// 14. سجل التدقيق
// ============================================================

function renderAudit() {
    if (currentUser.role !== 'Admin') return;
    const tbody = document.getElementById('audit-tbody');
    const audit = getData('audit') || [];

    const page = pagination.audit;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const paginated = audit.slice(start, start + ITEMS_PER_PAGE);

    const fragment = document.createDocumentFragment();
    paginated.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
                    <td><strong>${a.user}</strong></td>
                    <td><span class="badge badge-gold">${a.action}</span></td>
                    <td>${a.details || ''}</td>
                    <td style="direction:ltr; text-align:right; font-size:var(--font-sm);">${new Date(a.date).toLocaleString('ar')}</td>
                `;
        fragment.appendChild(tr);
    });

    requestAnimationFrame(() => {
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        renderPagination('audit-pagination', audit.length, page, (p) => {
            pagination.audit = p;
            renderAudit();
        });
    });
}

// ============================================================
// 15. الإعدادات
// ============================================================

function loadSettings() {
    const settings = getData('settings') || DEFAULT_SETTINGS;

    document.getElementById('setting-company').value = settings.companyName || '';
    document.getElementById('setting-currency').value = settings.currency || 'SAR';
    document.getElementById('setting-date-format').value = settings.dateFormat || 'DD/MM/YYYY';
    document.getElementById('setting-leave-balance').value = settings.defaultLeaveBalance || 21;

    const daysContainer = document.getElementById('work-days-checkboxes');
    const daysNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    daysContainer.innerHTML = '';
    daysNames.forEach((name, idx) => {
        const checked = settings.workDays?.includes(idx) ? 'checked' : '';
        daysContainer.innerHTML += `
                    <label style="display:flex; align-items:center; gap:0.3rem;">
                        <input type="checkbox" class="work-day-cb" value="${idx}" ${checked}> ${name}
                    </label>
                `;
    });

    renderTags('dept-tags', settings.departments || [], 'dept');
    renderTags('job-tags', settings.jobTitles || [], 'job');
    renderTags('leave-tags', settings.leaveTypes?.map(l => l.name) || [], 'leave');
}

function renderTags(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map((item, idx) => `
                <span class="tag">
                    ${item}
                    <button class="remove-tag" onclick="removeTag('${type}', ${idx})">&times;</button>
                </span>
            `).join('');
}

function removeTag(type, idx) {
    const settings = getData('settings') || DEFAULT_SETTINGS;
    if (type === 'dept') settings.departments.splice(idx, 1);
    else if (type === 'job') settings.jobTitles.splice(idx, 1);
    else if (type === 'leave') settings.leaveTypes.splice(idx, 1);
    setData('settings', settings);
    loadSettings();
    populateSelects();
    showToast('تم الحذف');
}

document.getElementById('add-dept-btn').addEventListener('click', () => {
    const input = document.getElementById('new-dept-input');
    const val = input.value.trim();
    if (!val) return;
    const settings = getData('settings') || DEFAULT_SETTINGS;
    if (!settings.departments.includes(val)) {
        settings.departments.push(val);
        setData('settings', settings);
        input.value = '';
        loadSettings();
        populateSelects();
        showToast('✅ تمت إضافة القسم');
    }
});

document.getElementById('add-job-btn').addEventListener('click', () => {
    const input = document.getElementById('new-job-input');
    const val = input.value.trim();
    if (!val) return;
    const settings = getData('settings') || DEFAULT_SETTINGS;
    if (!settings.jobTitles.includes(val)) {
        settings.jobTitles.push(val);
        setData('settings', settings);
        input.value = '';
        loadSettings();
        populateSelects();
        showToast('✅ تمت إضافة المسمى');
    }
});

document.getElementById('add-leave-btn').addEventListener('click', () => {
    const input = document.getElementById('new-leave-input');
    const val = input.value.trim();
    const deduct = document.getElementById('new-leave-deduct').value === 'true';
    if (!val) return;
    const settings = getData('settings') || DEFAULT_SETTINGS;
    if (!settings.leaveTypes.some(l => l.name === val)) {
        settings.leaveTypes.push({ name: val, deduct });
        setData('settings', settings);
        input.value = '';
        loadSettings();
        populateSelects();
        showToast('✅ تمت إضافة نوع الإجازة');
    }
});

document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = getData('settings') || DEFAULT_SETTINGS;

    settings.companyName = document.getElementById('setting-company').value;
    settings.currency = document.getElementById('setting-currency').value;
    settings.dateFormat = document.getElementById('setting-date-format').value;
    settings.defaultLeaveBalance = parseInt(document.getElementById('setting-leave-balance').value) || 21;

    const workDays = [];
    document.querySelectorAll('.work-day-cb:checked').forEach(cb => {
        workDays.push(parseInt(cb.value));
    });
    settings.workDays = workDays;

    setData('settings', settings);
    logAudit('تحديث الإعدادات', 'تم تحديث إعدادات النظام');
    showToast('✅ تم حفظ الإعدادات');
    document.getElementById('company-name').textContent = settings.companyName || 'نظام HR';
    populateSelects();
});

function resetSettings() {
    if (!confirm('استعادة الإعدادات الافتراضية؟')) return;
    setData('settings', DEFAULT_SETTINGS);
    loadSettings();
    populateSelects();
    showToast('✅ تمت الاستعادة');
}

// ============================================================
// 16. التصدير والاستيراد
// ============================================================

function exportEmployeesPDF() {
    const emps = getData('employees') || [];
    const settings = getData('settings') || DEFAULT_SETTINGS;
    const el = document.createElement('div');
    el.style.padding = '20px';
    el.style.direction = 'rtl';
    el.style.background = '#fff';
    el.style.color = '#000';
    let rows = emps.map(e =>
        `<tr><td>${e.name}</td><td>${e.email}</td><td>${e.dept}</td><td>${e.job}</td><td>${e.salary} ${settings.currency}</td></tr>`
    ).join('');
    el.innerHTML = `
                <h2 style="color:#d4af37;">قائمة الموظفين</h2>
                <hr>
                <table border="1" style="width:100%; border-collapse:collapse; text-align:right; margin-top:10px;">
                    <tr><th>الاسم</th><th>البريد</th><th>القسم</th><th>المسمى</th><th>الراتب</th></tr>
                    ${rows}
                </table>
            `;
    html2pdf().from(el).save('employees_report.pdf');
    logAudit('تصدير PDF', 'تصدير قائمة الموظفين PDF');
    showToast('✅ تم التصدير');
}

function exportEmployeesCSV() {
    const emps = getData('employees') || [];
    if (!emps.length) return showToast('لا توجد بيانات', 'warning');
    const ws = XLSX.utils.json_to_sheet(emps);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employees.xlsx');
    logAudit('تصدير CSV', 'تصدير قائمة الموظفين Excel');
    showToast('✅ تم التصدير');
}

function exportPayrollPDF() {
    const payroll = getData('payroll') || [];
    const settings = getData('settings') || DEFAULT_SETTINGS;
    const month = document.getElementById('payroll-month').value || new Date().toISOString().slice(0, 7);
    const filtered = payroll.filter(p => p.month === month);
    if (!filtered.length) return showToast('لا توجد رواتب لهذا الشهر', 'warning');

    const el = document.createElement('div');
    el.style.padding = '20px';
    el.style.direction = 'rtl';
    el.style.background = '#fff';
    el.style.color = '#000';
    let rows = filtered.map(p => {
        const emp = (getData('employees') || []).find(e => e.id === p.empId);
        return `<tr><td>${emp?.name || '-'}</td><td>${p.basic}</td><td>${p.absence}</td><td>${p.deduction}</td><td>${p.bonus}</td><td><strong>${p.net}</strong></td></tr>`;
    }).join('');
    el.innerHTML = `
                <h2 style="color:#d4af37;">مسير الرواتب - ${month}</h2>
                <hr>
                <table border="1" style="width:100%; border-collapse:collapse; text-align:center; margin-top:10px;">
                    <tr><th>الموظف</th><th>الأساسي</th><th>الغياب</th><th>الخصم</th><th>المكافأة</th><th>الصافي</th></tr>
                    ${rows}
                </table>
            `;
    html2pdf().from(el).save(`payroll_${month}.pdf`);
    logAudit('تصدير PDF', 'تصدير مسير الرواتب PDF');
    showToast('✅ تم التصدير');
}

function exportAuditPDF() {
    const audit = getData('audit') || [];
    if (!audit.length) return showToast('لا توجد بيانات', 'warning');
    const el = document.createElement('div');
    el.style.padding = '20px';
    el.style.direction = 'rtl';
    el.style.background = '#fff';
    el.style.color = '#000';
    let rows = audit.map(a =>
        `<tr><td>${a.user}</td><td>${a.action}</td><td>${a.details || ''}</td><td>${new Date(a.date).toLocaleString()}</td></tr>`
    ).join('');
    el.innerHTML = `
                <h2 style="color:#d4af37;">سجل التدقيق</h2>
                <hr>
                <table border="1" style="width:100%; border-collapse:collapse; text-align:right; margin-top:10px;">
                    <tr><th>المستخدم</th><th>العملية</th><th>التفاصيل</th><th>التاريخ</th></tr>
                    ${rows}
                </table>
            `;
    html2pdf().from(el).save('audit_report.pdf');
    showToast('✅ تم التصدير');
}

function exportBackup() {
    const data = {};
    const keys = ['settings', 'users', 'employees', 'leaves', 'attendance', 'payroll', 'audit'];
    keys.forEach(k => data[k] = getData(k));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logAudit('نسخ احتياطي', 'تصدير نسخة احتياطية');
    showToast('✅ تم تصدير النسخة');
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const keys = ['settings', 'users', 'employees', 'leaves', 'attendance', 'payroll', 'audit'];
            keys.forEach(k => {
                if (data[k]) setData(k, data[k]);
            });
            logAudit('استيراد نسخة', 'استيراد نسخة احتياطية');
            showToast('✅ تم استيراد النسخة، سيتم إعادة التحميل');
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            showToast('❌ ملف غير صالح', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function importExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            let emps = getData('employees') || [];
            let added = 0;
            json.forEach(row => {
                const name = row.اسم || row.Name || row.name;
                const email = row.بريد || row.Email || row.email || `emp${Date.now()}@system.com`;
                const dept = row.قسم || row.Department || row.dept || 'عام';
                const job = row.مسمى || row.Job || row.job || 'موظف';
                const salary = parseFloat(row.راتب || row.Salary || row.salary || 5000);

                if (name) {
                    emps.push({
                        id: Date.now() + Math.random() * 1000,
                        name,
                        email,
                        dept,
                        job,
                        salary,
                        leaveBalance: 21,
                        status: 'نشط'
                    });
                    added++;
                }
            });
            setData('employees', emps);
            logAudit('استيراد Excel', `استيراد ${added} موظف من Excel`);
            showToast(`✅ تم استيراد ${added} موظف`);
            renderEmployees();
            loadDashboard();
            populateSelects();
        } catch (err) {
            showToast('❌ فشل قراءة الملف', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// ============================================================
// 17. دوال مساعدة (Pagination)
// ============================================================

function renderPagination(containerId, totalItems, currentPage, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => callback(i);
        container.appendChild(btn);
    }
}

// ============================================================
// 18. تهيئة التطبيق
// ============================================================

initStorage();

if (checkSession()) {
    startApp();
}

document.addEventListener('DOMContentLoaded', () => {
    const settings = getData('settings');
    if (settings?.companyName) {
        document.getElementById('company-name').textContent = settings.companyName;
    }
});

console.log('%c 🚀 نظام إدارة الموارد البشرية المتكامل ',
    'background:#d4af37;color:#0a0e17;font-size:18px;font-weight:bold;padding:12px 20px;border-radius:8px;');
console.log('%c ✨ تم التطوير بخبرة 15 سنة في أنظمة HR مع تحكم كامل للمالك ',
    'color:#d4af37;font-size:13px;');
