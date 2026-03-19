/* ============================================
FINCLARITY AI - Dashboard Interactivity (FINAL)
============================================ */

document.addEventListener('DOMContentLoaded', async function () {

    // 🔥 FIRST: check Supabase session
    await checkSupabaseAuth();

    // Then load normal data (wait for it to complete)
    await loadUserData();

    // Finally initialize dashboard
    initializeDashboard();
});


// ============================================
// 🔥 CHECK SUPABASE AUTH (IMPORTANT)
// ============================================

async function checkSupabaseAuth() {

    if (!window.supabase) {
        console.log("Supabase not loaded, checking backend session only");
        await checkBackendSession();
        return;
    }

    try {
        const { data: { session }, error } = await window.supabase.auth.getSession();

        if (error) {
            console.error("Supabase session error:", error);
            await checkBackendSession();
            return;
        }

        if (session && session.user) {

            const user = session.user;

            console.log("Supabase user detected:", user);

            // Sync with backend
            try {
                const res = await fetch("/api/google-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        name: user.user_metadata?.full_name || "User",
                        email: user.email
                    })
                });

                const data = await res.json();
                if (data.status !== "success") {
                    console.error("Failed to sync with backend");
                    await checkBackendSession();
                }
            } catch (syncErr) {
                console.error("Sync error:", syncErr);
                await checkBackendSession();
            }

        } else {
            // No Supabase session → check backend auth
            console.log("No Supabase session, checking backend");
            await checkBackendSession();
        }

    } catch (err) {
        console.error("Auth check error:", err);
        await checkBackendSession();
    }
}

async function checkBackendSession() {
    try {
        const res = await fetch('/api/user', {
            credentials: 'include'
        });

        if (!res.ok) {
            console.log("No backend session, redirecting to login");
            window.location.href = '/login';
            return;
        }

        const data = await res.json();
        if (data.status !== 'success') {
            console.log("Backend session invalid, redirecting to login");
            window.location.href = '/login';
        }
    } catch (err) {
        console.error("Backend session check error:", err);
        window.location.href = '/login';
    }
}


// ============================================
// INIT DASHBOARD
// ============================================

function initializeDashboard() {
    setupSidebarToggle();
    setupNavigation();
    setupChatPanel();
    setupChatInput();
    setupActionCards();
    setupResponsive();
    setupSettings();
}


// ============================================
// CHAT INPUT
// ============================================

function setupChatInput() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!chatInput || !sendBtn) return;

    sendBtn.disabled = true;

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatInput.addEventListener('input', function () {
        sendBtn.disabled = !this.value.trim();
    });
}


// ============================================
// SEND MESSAGE
// ============================================

async function sendMessage() {

    if (window.currentUserData && window.currentUserData.isGuest) {
        alert("Please log in to use the AI Assistant");
        window.location.href = '/login';
        return;
    }

    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!chatInput || !sendBtn) return;

    const message = chatInput.value.trim();
    if (!message) return;

    appendMessage(message, "user");

    chatInput.value = '';
    sendBtn.disabled = true;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            if (response.status === 401) {
                appendMessage("Please log in to use the AI Assistant", "ai");
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        const reply = data?.reply || "No response from AI.";
        appendMessage(reply, "ai");

    } catch (error) {
        console.error("Chat error:", error);
        appendMessage("Something went wrong. Try again.", "ai");
    }
}


// ============================================
// MESSAGE UI
// ============================================

function appendMessage(text, sender) {

    let chatBox = document.querySelector('.chat-messages');

    if (!chatBox) {
        chatBox = document.createElement('div');
        chatBox.className = 'chat-messages';

        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        mainContent.appendChild(chatBox);
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${sender}`;
    bubble.textContent = text;

    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);

    chatBox.scrollTop = chatBox.scrollHeight;
}


// ============================================
// SETTINGS & LOGOUT (FIXED)
// ============================================

function setupSettings() {

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', function () {
            settingsDropdown.classList.toggle('active');
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.header-actions')) {
                settingsDropdown.classList.remove('active');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {

            try {
                // 🔥 Supabase logout
                if (window.supabase) {
                    await window.supabase.auth.signOut();
                }

                // Flask logout
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                localStorage.removeItem('currentUser');

                window.location.href = '/login';

            } catch (error) {
                console.error('Logout error:', error);
                alert('Error logging out.');
            }
        });
    }
}


// ============================================
// USER DATA
// ============================================

async function loadUserData() {

    return fetch('/api/user', {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                window.currentUserData = data.user;
                console.log("User data loaded:", window.currentUserData);
            }
        })
        .catch(err => {
            console.error('Error loading user data:', err);

            const localUser = localStorage.getItem('currentUser');
            if (localUser) {
                window.currentUserData = JSON.parse(localUser);
                console.log("User data loaded from localStorage:", window.currentUserData);
            }
        });
}


// ============================================
// PLACEHOLDERS
// ============================================

function setupSidebarToggle() { }
function setupNavigation() { }
function setupChatPanel() { }
function setupActionCards() { }
function setupResponsive() { }


// ============================================

console.log('Finclarity AI Dashboard loaded successfully');