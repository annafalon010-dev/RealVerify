import { getFraudFlags, dismissFraudFlag, monitorRecentUploads } from './fraud.js';

function getClient() {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase client is not loaded. Make sure js/supabase.js is included before js/admin.js.');
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

function showMessage(containerId, message) {
    const container = document.getElementById(containerId);

    if (!container) {
        return;
    }

    container.innerHTML = `<div class="admin-empty-state">${escapeHTML(message)}</div>`;
}

function getDocumentUrls(property) {
    const documents = property?.doc_urls || property?.document_urls || property?.documents || property?.document_files;

    if (Array.isArray(documents)) {
        return documents.filter(Boolean);
    }

    if (typeof documents === 'string' && documents.trim()) {
        try {
            const parsedDocuments = JSON.parse(documents);

            if (Array.isArray(parsedDocuments)) {
                return parsedDocuments.filter(Boolean);
            }
        } catch (error) {
            return [documents];
        }
    }

    return [];
}

function renderDocuments(property) {
    const documents = getDocumentUrls(property);

    if (documents.length === 0) {
        return '<span class="text-muted">No documents</span>';
    }

    return documents.map((documentUrl, index) => `
        <a href="${escapeHTML(documentUrl)}" target="_blank" rel="noopener">Document ${index + 1}</a>
    `).join('<br>');
}

function getSubmitter(property) {
    const profile = property.profiles || property.profile || property.submitter || null;

    return {
        name: profile?.full_name || 'Unknown user',
        email: profile?.email || 'Email unavailable'
    };
}

async function insertNotification(userId, message) {
    if (!userId || !message) {
        return;
    }

    const { error } = await getClient()
        .from('notifications')
        .insert({
            user_id: userId,
            message,
            is_read: false,
            created_at: new Date().toISOString()
        });

    if (error) {
        console.error('Notification insert failed:', error);
    }
}

async function getPropertyForAction(propertyId) {
    const { data, error } = await getClient()
        .from('properties')
        .select('id, title, user_id')
        .eq('id', propertyId)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function checkAdminAuth() {
    const client = getClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session) {
        window.location.href = 'login.html';
        return null;
    }

    const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile || profile.role !== 'admin') {
        window.alert('Access denied. Admins only.');
        window.location.href = 'index.html';
        return null;
    }

    return profile;
}

export async function loadAdminStats() {
    const client = getClient();

    const [totalResult, verifiedResult, pendingResult, rejectedResult, usersResult, flagsResult] = await Promise.all([
        client.from('properties').select('*', { count: 'exact', head: true }),
        client.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'verified'),
        client.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        client.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        client.from('profiles').select('*', { count: 'exact', head: true }),
        client.from('fraud_flags').select('*', { count: 'exact', head: true }).eq('is_dismissed', false)
    ]);

    const results = [totalResult, verifiedResult, pendingResult, rejectedResult, usersResult, flagsResult];
    const failedResult = results.find((result) => result.error);

    if (failedResult) {
        console.error('Admin stats error:', failedResult.error);
    }

    setStatNumber('admin-stat-total', totalResult.count || 0);
    setStatNumber('admin-stat-verified', verifiedResult.count || 0);
    setStatNumber('admin-stat-pending', pendingResult.count || 0);
    setStatNumber('admin-stat-rejected', rejectedResult.count || 0);
    setStatNumber('admin-stat-users', usersResult.count || 0);
    setStatNumber('admin-stat-flags', flagsResult.count || 0);
}

export async function loadPendingListings() {
    const container = document.getElementById('pending-listings-table');

    if (!container) {
        return;
    }

    container.innerHTML = '<div class="admin-loading">Loading pending listings...</div>';

    try {
        const { data, error } = await getClient()
            .from('properties')
            .select('*, profiles:user_id (full_name, email)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        const listings = data || [];

        if (listings.length === 0) {
            showMessage('pending-listings-table', 'All caught up!');
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Submitted By</th>
                        <th>Location</th>
                        <th>Date</th>
                        <th>Documents</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${listings.map((property) => {
                        const submitter = getSubmitter(property);

                        return `
                            <tr>
                                <td><a href="property-details.html?id=${encodeURIComponent(property.id)}">${escapeHTML(property.title || 'Untitled Property')}</a></td>
                                <td>
                                    <strong>${escapeHTML(submitter.name)}</strong><br>
                                    <span>${escapeHTML(submitter.email)}</span>
                                </td>
                                <td>${escapeHTML(property.location || 'Location unavailable')}</td>
                                <td>${formatDate(property.created_at)}</td>
                                <td>${renderDocuments(property)}</td>
                                <td>
                                    <button class="admin-action-btn approve-btn" type="button" data-approve-id="${escapeHTML(property.id)}">Approve</button>
                                    <button class="admin-action-btn reject-btn" type="button" data-reject-id="${escapeHTML(property.id)}">Reject</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        container.querySelectorAll('[data-approve-id]').forEach((button) => {
            button.addEventListener('click', () => approveProperty(button.dataset.approveId));
        });

        container.querySelectorAll('[data-reject-id]').forEach((button) => {
            button.addEventListener('click', () => showRejectDialog(button.dataset.rejectId));
        });
    } catch (error) {
        console.error('Pending listings error:', error);
        showMessage('pending-listings-table', 'Unable to load pending listings.');
    }
}

export async function approveProperty(propertyId) {
    if (!propertyId) {
        return;
    }

    const confirmed = window.confirm('Approve this property listing?');

    if (!confirmed) {
        return;
    }

    try {
        const property = await getPropertyForAction(propertyId);
        const { error } = await getClient()
            .from('properties')
            .update({
                status: 'verified',
                verified_at: new Date().toISOString(),
                admin_notes: 'Verified by admin'
            })
            .eq('id', propertyId);

        if (error) {
            throw error;
        }

        await insertNotification(property.user_id, `Your listing ${property.title} has been verified!`);
        await loadPendingListings();
        await loadAdminStats();
    } catch (error) {
        console.error('Approve property error:', error);
        window.alert('Unable to approve property. Please try again.');
    }
}

export async function showRejectDialog(propertyId) {
    if (!propertyId) {
        return;
    }

    const reason = window.prompt('Enter the rejection reason:');

    if (!reason || !reason.trim()) {
        window.alert('Reason is required');
        return;
    }

    try {
        const property = await getPropertyForAction(propertyId);
        const cleanReason = reason.trim();
        const { error } = await getClient()
            .from('properties')
            .update({
                status: 'rejected',
                admin_notes: cleanReason
            })
            .eq('id', propertyId);

        if (error) {
            throw error;
        }

        await insertNotification(property.user_id, `Your listing ${property.title} was rejected. Reason: ${cleanReason}`);
        await loadPendingListings();
        await loadAdminStats();
    } catch (error) {
        console.error('Reject property error:', error);
        window.alert('Unable to reject property. Please try again.');
    }
}

function renderFraudFlag(flag) {
    const propertyTitle = flag.properties?.title || flag.property?.title || 'Unknown property';
    const reporterName = flag.profiles?.full_name || flag.profiles?.email || flag.reporter?.full_name || 'Unknown reporter';

    return `
        <article class="fraud-alert-card">
            <div>
                <h4>${escapeHTML(propertyTitle)}</h4>
                <p><strong>Reporter:</strong> ${escapeHTML(reporterName)}</p>
                <p><strong>Reason:</strong> ${escapeHTML(flag.reason || 'No reason provided')}</p>
                <p><strong>Date:</strong> ${formatDate(flag.created_at)}</p>
            </div>
            <button class="admin-action-btn dismiss-btn" type="button" data-dismiss-flag="${escapeHTML(flag.id)}">Dismiss</button>
        </article>
    `;
}

function renderSpamWarning(user) {
    return `
        <article class="fraud-alert-card spam-warning">
            <div>
                <h4>Suspicious Upload Volume</h4>
                <p><strong>User ID:</strong> ${escapeHTML(user.user_id)}</p>
                <p><strong>Uploads:</strong> ${escapeHTML(user.upload_count)}</p>
                <p>${escapeHTML(user.reason)}</p>
            </div>
        </article>
    `;
}

export async function loadFraudAlerts() {
    const container = document.getElementById('fraud-alerts-list');

    if (!container) {
        return;
    }

    container.innerHTML = '<div class="admin-loading">Loading fraud alerts...</div>';

    try {
        const [fraudFlags, uploadMonitor] = await Promise.all([
            getFraudFlags(),
            monitorRecentUploads()
        ]);

        const flags = fraudFlags || [];
        const suspiciousUsers = uploadMonitor?.suspiciousUsers || [];

        if (flags.length === 0 && suspiciousUsers.length === 0) {
            showMessage('fraud-alerts-list', 'No fraud alerts');
            return;
        }

        container.innerHTML = `
            ${suspiciousUsers.map(renderSpamWarning).join('')}
            ${flags.map(renderFraudFlag).join('')}
        `;

        container.querySelectorAll('[data-dismiss-flag]').forEach((button) => {
            button.addEventListener('click', async () => {
                const result = await dismissFraudFlag(button.dataset.dismissFlag);

                if (!result.success) {
                    window.alert('Unable to dismiss fraud alert.');
                    return;
                }

                await loadFraudAlerts();
                await loadAdminStats();
            });
        });
    } catch (error) {
        console.error('Fraud alerts error:', error);
        showMessage('fraud-alerts-list', 'Unable to load fraud alerts.');
    }
}

function renderRoleBadge(role) {
    const normalizedRole = String(role || 'user').toLowerCase();

    if (normalizedRole === 'admin') {
        return '<span class="role-badge role-admin">Admin</span>';
    }

    return '<span class="role-badge role-user">User</span>';
}

export async function loadAllUsers() {
    const container = document.getElementById('all-users-table');

    if (!container) {
        return;
    }

    container.innerHTML = '<div class="admin-loading">Loading users...</div>';

    try {
        const { data, error } = await getClient()
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        const users = data || [];

        if (users.length === 0) {
            showMessage('all-users-table', 'No users found.');
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map((user) => `
                        <tr>
                            <td>${escapeHTML(user.full_name || 'Unnamed user')}</td>
                            <td>${escapeHTML(user.email || 'Email unavailable')}</td>
                            <td>${renderRoleBadge(user.role)}</td>
                            <td>${formatDate(user.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Users table error:', error);
        showMessage('all-users-table', 'Unable to load users.');
    }
}

export function setupAdminSidebar() {
    const links = Array.from(document.querySelectorAll('[data-section]'));
    const sections = Array.from(document.querySelectorAll('[data-admin-section], .admin-section'));

    if (links.length === 0 || sections.length === 0) {
        return;
    }

    const activateSection = (sectionName) => {
        sections.forEach((section) => {
            const currentName = section.dataset.adminSection || section.id;
            section.hidden = currentName !== sectionName;
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

async function initAdminDashboard() {
    const profile = await checkAdminAuth();

    if (!profile) {
        return;
    }

    setupAdminSidebar();
    await loadAdminStats();
    await loadPendingListings();
    await loadFraudAlerts();
    await loadAllUsers();
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initAdminDashboard);
}

if (typeof window !== 'undefined') {
    window.checkAdminAuth = checkAdminAuth;
    window.loadAdminStats = loadAdminStats;
    window.loadPendingListings = loadPendingListings;
    window.approveProperty = approveProperty;
    window.showRejectDialog = showRejectDialog;
    window.loadFraudAlerts = loadFraudAlerts;
    window.loadAllUsers = loadAllUsers;
    window.setupAdminSidebar = setupAdminSidebar;
}
