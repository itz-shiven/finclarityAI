/* ============================================
FINCLARITY AI - Dashboard Interactivity
============================================ */

document.addEventListener('DOMContentLoaded', function () {
    loadUserData();
    initializeDashboard();
});

function initializeDashboard() {
    setupSidebarToggle();
    setupNavigation();
    setupChatPanel();
    setupChatInput();
    setupActionCards();
    setupResponsive();
}

// ============================================
// CHAT INPUT (FIXED)
// ============================================

function setupChatInput() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!chatInput || !sendBtn) return; // 🔥 prevent null errors

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
// SEND MESSAGE (FIXED)
// ============================================

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!chatInput || !sendBtn) return;

    const message = chatInput.value.trim();
    if (!message) return;

    // Show user message
    appendMessage(message, "user");

    chatInput.value = '';
    sendBtn.disabled = true;

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // 🔥 safer fallback
        const reply = data?.reply || "No response from AI.";
        appendMessage(reply, "ai");

    } catch (error) {
        console.error("Chat error:", error);
        appendMessage("Something went wrong. Try again.", "ai");
    }
}

// ============================================
// MESSAGE UI (IMPROVED)
// ============================================

function appendMessage(text, sender) {
    let chatBox = document.querySelector('.chat-messages');

    // Create chat box if not exists
    if (!chatBox) {
        chatBox = document.createElement('div');
        chatBox.className = 'chat-messages';

        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return; // 🔥 prevent crash

        mainContent.appendChild(chatBox);
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;

    // 🔥 prevent XSS (important!)
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${sender}`;
    bubble.textContent = text;

    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);

    chatBox.scrollTop = chatBox.scrollHeight;
}

// ============================================
// KEEP REST SAME
// ============================================

console.log('Finclarity AI Dashboard loaded successfully');