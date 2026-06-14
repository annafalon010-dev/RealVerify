function getSupabaseClient() {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase client is not loaded. Make sure js/supabase.js is included before js/auth.js.');
    }

    return supabaseClient;
}

function getMessageElement(id) {
    return document.getElementById(id);
}

function hideMessage(id) {
    const element = getMessageElement(id);

    if (!element) {
        return;
    }

    element.textContent = '';
    element.classList.remove('show');
}

function showError(message) {
    const errorMsg = getMessageElement('error-msg');

    hideMessage('success-msg');

    if (!errorMsg) {
        return;
    }

    errorMsg.textContent = message;
    errorMsg.classList.add('show');
}

function showSuccess(message) {
    const successMsg = getMessageElement('success-msg');

    hideMessage('error-msg');

    if (!successMsg) {
        return;
    }

    successMsg.textContent = message;
    successMsg.classList.add('show');
}

function setLoading(button, isLoading) {
    if (!button) {
        return;
    }

    if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? 'Please wait...' : button.dataset.originalText;
}

function clearMessages() {
    hideMessage('error-msg');
    hideMessage('success-msg');
}

function redirectTo(page, delay = 0) {
    window.setTimeout(() => {
        window.location.href = page;
    }, delay);
}

function initSignupForm() {
    const form = document.getElementById('signup-form');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessages();

        const signupBtn = document.getElementById('signup-btn');
        const fullName = document.getElementById('full-name')?.value.trim();
        const email = document.getElementById('email')?.value.trim();
        const password = document.getElementById('password')?.value;
        const confirmPassword = document.getElementById('confirm-password')?.value;

        if (!fullName || !email || !password || !confirmPassword) {
            showError('Please fill in all fields.');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match.');
            return;
        }

        setLoading(signupBtn, true);

        try {
            const client = getSupabaseClient();
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) {
                throw error;
            }

            const user = data.user;

            if (!user) {
                throw new Error('Account created, but user data was not returned. Please check your email to continue.');
            }

            showSuccess('Account created successfully! Please check your email inbox and click the confirmation link before logging in.');
        } catch (error) {
            showError(error.message || 'Unable to create account. Please try again.');
        } finally {
            setLoading(signupBtn, false);
        }
    });
}

function initLoginForm() {
    const form = document.getElementById('login-form');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessages();

        const loginBtn = document.getElementById('login-btn');
        const email = document.getElementById('email')?.value.trim();
        const password = document.getElementById('password')?.value;

        if (!email || !password) {
            showError('Please enter your email and password.');
            return;
        }

        setLoading(loginBtn, true);

        try {
            const client = getSupabaseClient();
            const { error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                if (error.message.includes('Email not confirmed')) {
                    showError('Please check your email inbox and click the confirmation link we sent you before logging in.');
                    return;
                }

                if (error.message.includes('Invalid login credentials')) {
                    showError('Invalid email or password. Please try again.');
                    return;
                }

                showError(error.message || 'Unable to sign in. Please try again.');
                return;
            }

            showSuccess('Welcome back! Redirecting...');
            redirectTo('dashboard.html', 1000);
        } catch (error) {
            showError(error.message || 'Unable to sign in. Please try again.');
        } finally {
            setLoading(loginBtn, false);
        }
    });
}

function initRecoverForm() {
    const form = document.getElementById('recover-form');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessages();

        const recoverBtn = document.getElementById('recover-btn');
        const email = document.getElementById('email')?.value.trim();

        if (!email) {
            showError('Please enter your email address.');
            return;
        }

        setLoading(recoverBtn, true);

        try {
            const client = getSupabaseClient();
            const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/set-password.html'
            });

            if (error) {
                throw error;
            }

            showSuccess('Reset link sent! Check your email inbox.');
        } catch (error) {
            showError(error.message || 'Unable to send reset link. Please try again.');
        } finally {
            setLoading(recoverBtn, false);
        }
    });
}

async function signOut() {
    const client = getSupabaseClient();

    await client.auth.signOut();
    window.location.href = 'index.html';
}

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    return session.user;
}

async function getCurrentUser() {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getUser();
    const user = data?.user;

    if (error || !user) {
        return null;
    }

    const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return {
        user,
        profile: profileError ? null : profile
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initSignupForm();
    initLoginForm();
    initRecoverForm();
});

window.showError = showError;
window.showSuccess = showSuccess;
window.setLoading = setLoading;
window.signOut = signOut;
window.checkAuth = checkAuth;
window.getCurrentUser = getCurrentUser;
