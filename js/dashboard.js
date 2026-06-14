function getSupabaseClient() {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase client is not loaded. Make sure js/supabase.js is included before js/dashboard.js.');
    }

    return supabaseClient;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        };

        return entities[character];
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return 'Date unavailable';
    }

    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatPrice(price) {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
        return '₦0';
    }

    return `₦${numericPrice.toLocaleString('en-NG')}`;
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function setStatNumber(id, value) {
    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.dataset.countTo = String(value);
    element.dataset.countSuffix = '';

    if (typeof window.animateRealVerifyCounter === 'function') {
        window.animateRealVerifyCounter(element);
        return;
    }

    element.textContent = String(value);
}

function updateStatusChart(total, verified, pending, rejected) {
    const donut = document.getElementById('status-donut');
    const label = document.getElementById('status-donut-label');

    const verifiedAngle = total ? (verified / total) * 360 : 0;
    const pendingAngle = total ? verifiedAngle + ((pending / total) * 360) : 0;

    if (donut) {
        donut.style.setProperty('--verified-angle', `${verifiedAngle}deg`);
        donut.style.setProperty('--pending-angle', `${pendingAngle}deg`);
    }

    setText('legend-verified', verified);
    setText('legend-pending', pending);
    setText('legend-rejected', rejected);

    if (label) {
        label.textContent = `${total} ${total === 1 ? 'listing' : 'listings'}`;
    }
}

async function getSessionUser() {
    return checkAuth();
}

async function getUserProfile(userId) {
    const { data, error } = await getSupabaseClient()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Unable to load profile:', error);
        return null;
    }

    return data;
}

function statusBadge(status) {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    const label = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
    return `<span class="status-badge status-${escapeHTML(normalizedStatus)}">${escapeHTML(label)}</span>`;
}

function propertyCard(property) {
    return `
        <article class="dashboard-property-card">
            <div class="dashboard-property-header">
                <h3>${escapeHTML(property.title || 'Untitled Property')}</h3>
                ${statusBadge(property.status)}
            </div>
            <div class="dashboard-property-meta">
                <span>${escapeHTML(property.location || 'Location unavailable')}</span>
                <span>${escapeHTML(property.type || 'Property')}</span>
                <span>${formatPrice(property.price)}</span>
                <span>${formatDate(property.created_at)}</span>
            </div>
            <a class="view-details-btn" href="property-details.html?id=${encodeURIComponent(property.id)}">View Details</a>
        </article>
    `;
}

function notificationCard(notification) {
    return `
        <article class="notification-card">
            <h3>${escapeHTML(notification.message || 'Notification')}</h3>
            <p>${formatDate(notification.created_at)}</p>
        </article>
    `;
}

function renderEmpty(containerId, message) {
    const container = document.getElementById(containerId);

    if (container) {
        container.innerHTML = `<div class="empty-state">${escapeHTML(message)}</div>`;
    }
}

function updateStats(properties) {
    const total = properties.length;
    const verified = properties.filter((property) => property.status === 'verified').length;
    const pending = properties.filter((property) => property.status === 'pending').length;
    const rejected = properties.filter((property) => property.status === 'rejected').length;

    setStatNumber('stat-total', total);
    setStatNumber('stat-verified', verified);
    setStatNumber('stat-pending', pending);
    setStatNumber('stat-rejected', rejected);
    updateStatusChart(total, verified, pending, rejected);
}

async function loadUserProperties(userId) {
    const { data, error } = await getSupabaseClient()
        .from('properties')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Unable to load properties:', error);
        updateStats([]);
        renderEmpty('recent-properties', 'Unable to load properties.');
        renderEmpty('user-properties', 'Unable to load properties.');
        return;
    }

    const properties = data || [];
    updateStats(properties);

    if (properties.length === 0) {
        renderEmpty('recent-properties', 'No properties submitted yet.');
        renderEmpty('user-properties', 'No properties submitted yet. Use Upload Property to create your first listing.');
        return;
    }

    const recentProperties = document.getElementById('recent-properties');
    const userProperties = document.getElementById('user-properties');

    if (recentProperties) {
        recentProperties.innerHTML = properties.slice(0, 3).map(propertyCard).join('');
    }

    if (userProperties) {
        userProperties.innerHTML = properties.map(propertyCard).join('');
    }
}

async function loadNotifications(userId) {
    const { data, error } = await getSupabaseClient()
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Unable to load notifications:', error);
        renderEmpty('recent-notifications', 'Unable to load notifications.');
        renderEmpty('notifications-list', 'Unable to load notifications.');
        return;
    }

    const notifications = data || [];

    if (notifications.length === 0) {
        renderEmpty('recent-notifications', 'No notifications yet.');
        renderEmpty('notifications-list', 'No notifications yet.');
        return;
    }

    const recentNotifications = document.getElementById('recent-notifications');
    const notificationsList = document.getElementById('notifications-list');

    if (recentNotifications) {
        recentNotifications.innerHTML = notifications.slice(0, 3).map(notificationCard).join('');
    }

    if (notificationsList) {
        notificationsList.innerHTML = notifications.map(notificationCard).join('');
    }
}

function setupDashboardSidebar() {
    const links = Array.from(document.querySelectorAll('[data-section]'));
    const sections = Array.from(document.querySelectorAll('[data-dashboard-section]'));

    if (links.length === 0 || sections.length === 0) {
        return;
    }

    const activateSection = (sectionName) => {
        sections.forEach((section) => {
            section.hidden = section.dataset.dashboardSection !== sectionName;
        });

        links.forEach((link) => {
            const isActive = link.dataset.section === sectionName;
            link.classList.toggle('active', isActive);
        });
    };

    links.forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            activateSection(link.dataset.section);
        });
    });

    activateSection(links[0].dataset.section);
}

function setupSignOut() {
    const buttons = [
        document.getElementById('dashboard-signout-btn'),
        document.getElementById('signout-btn-sidebar')
    ].filter(Boolean);

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            await getSupabaseClient().auth.signOut();
            window.location.href = 'index.html';
        });
    });
}

async function initDashboard() {
    const user = await getSessionUser();

    if (!user) {
        return;
    }

    const profile = await getUserProfile(user.id);

    if (profile?.full_name) {
        setText('user-name', profile.full_name);
    } else {
        setText('user-name', user.email || 'RealVerify User');
    }

    const adminLink = document.getElementById('admin-link');

    if (adminLink && profile?.role === 'admin') {
        adminLink.hidden = false;
    }

    setupDashboardSidebar();
    setupSignOut();
    await Promise.all([
        loadUserProperties(user.id),
        loadNotifications(user.id)
    ]);
}

document.addEventListener('DOMContentLoaded', initDashboard);
