async function runInitialization() {
    console.log("Finclarity AI: Initializing application...");
    await checkSupabaseAuth();
    await loadUserData();

    if (typeof loadLocalChats === 'function') loadLocalChats();

    initializeDashboard();
    setupSettingsAndLogout();
    setupProfileModal();
    setupComparisonFeature();
}

// FIX: If script is loaded dynamically after DOMContentLoaded, the listener won't fire.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitialization);
} else {
    runInitialization();
}

let comparisonList = []; // Global comparison state
let financeData = { todos: [] };


async function checkSupabaseAuth() {

    if (!window.supabase) {
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

            try {
                const res = await fetch("/api/google-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        id: user.id,
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
            window.location.href = '/login';
            return;
        }

        const data = await res.json();
        if (data.status !== 'success') {
            window.location.href = '/login';
        }
    } catch (err) {
        console.error("Backend session check error:", err);
        window.location.href = '/login';
    }
}


function initializeDashboard() {
    console.log("Finclarity AI: Dashboard initializing...");
    // Reset Navigation Stack to Home
    navStack = [{ id: 'mainView', title: 'Home' }];
    renderBreadcrumb();

    // Ensure main view is visible and animate it in
    const mainView = document.getElementById('mainView');
    if (mainView) {
        mainView.classList.remove('hidden');
        mainView.style.opacity = '1';
        mainView.style.display = 'block';
    }

    // NEW: Check for guest access and update UI
    if (typeof checkGuestAccess === 'function') checkGuestAccess();

    setupSidebarCollapse();
    setupNavigation();
    setupChatPanel();
    setupChatInput();
    setupActionCards();
    setupComparisonFeature();
    setupResponsive();

    // Premium Home Page Animations
    if (typeof setupHomePageSexyLogic === 'function') {
        setupHomePageSexyLogic();
    }
    renderFinanceModuleViews();
}


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
// Logic for sending messages and handling AI interaction.

// ============================================
// SEND MESSAGE (Bulletproof Streaming)
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

    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    if (welcomeSubtitle && message) {
        welcomeSubtitle.textContent = `Latest interaction: "${message}"`;
    }

    chatInput.value = '';
    sendBtn.disabled = true;

    const loaderId = appendLoader();

    try {
        currentConversation.push({ role: "user", content: message });

        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                message: message,
                history: currentConversation.slice(-30),
                user_memory: JSON.parse(localStorage.getItem(getUserKey('finclarityMemory')) || '[]')
            })
        });

        if (!response.ok) {
            removeLoader(loaderId);
            if (response.status === 401) {
                appendMessage("Please log in to use the AI Assistant", "ai");
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }
            throw new Error(`Server error: ${response.status}`);
        }

        // --- BULLETPROOF STREAM HANDLING ---
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";
        let buffer = ""; // This holds incomplete chunks

        removeLoader(loaderId);
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = `chat-message ai`;
        const aiBubbleId = 'ai-bubble-' + Date.now();
        aiMessageDiv.innerHTML = createMessageHTML("", "ai", aiBubbleId);
        document.getElementById('chatMessages').appendChild(aiMessageDiv);
        const aiBubble = document.getElementById(aiBubbleId);
        scrollToBottom();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // decode with stream: true to prevent splitting multi-byte characters
            buffer += decoder.decode(value, { stream: true });

            // Split by newline to process complete events
            let lines = buffer.split('\n');

            // The last item might be incomplete, keep it in the buffer for the next loop
            buffer = lines.pop();

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('data: ')) {
                    const jsonStr = trimmedLine.substring(6);
                    if (jsonStr === "[DONE]") continue; // Standard SSE close tag

                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.chunk) {
                            fullReply += data.chunk;
                            aiBubble.innerHTML = window.marked ? marked.parse(fullReply) : fullReply;
                            scrollToBottom();
                        }
                    } catch (e) {
                        console.warn("Incomplete JSON chunk caught and bypassed:", e, jsonStr);
                    }
                }
            }
        }

        let reply = fullReply || "No response from AI.";

        // Final Post-processing (Memory extraction)
        const memoryMatches = reply.match(/\[MEMORY:(.*?)\]/g);
        if (memoryMatches) {
            let memories = JSON.parse(localStorage.getItem(getUserKey('finclarityMemory')) || '[]');
            memoryMatches.forEach(match => {
                const fact = match.replace('[MEMORY:', '').replace(']', '').trim();
                if (!memories.includes(fact)) memories.push(fact);
            });
            localStorage.setItem(getUserKey('finclarityMemory'), JSON.stringify(memories));
            if (typeof syncUserDataToBackend === 'function') syncUserDataToBackend();

            // Re-render without memory tags
            reply = reply.replace(/\[MEMORY:(.*?)\]/g, '').trim();
            aiBubble.innerHTML = window.marked ? marked.parse(reply) : reply;
        }

        if (reply === "" && fullReply.includes("[MEMORY:")) reply = "Okay, I'll remember that!";

        currentConversation.push({ role: "assistant", content: reply });
        saveCurrentChat();

    } catch (error) {
        removeLoader(loaderId);
        console.error("Chat error:", error);
        appendMessage("Something went wrong. Try again.", "ai");
    }
}


function appendMessage(text, sender) {
    let chatBox = document.getElementById('chatMessages');
    if (!chatBox) {
        console.error("[APPEND] CRITICAL: chatMessages element not found in DOM!");
        return;
    }
    console.log("[APPEND] Appending message to chatBox:", text.substring(0, 30));

    let newChatArea = document.getElementById('newChatArea');
    if (newChatArea && newChatArea.style.display !== 'none') {
        newChatArea.style.display = 'none';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    messageDiv.innerHTML = createMessageHTML(text, sender);

    chatBox.appendChild(messageDiv);

    // Store index for future editing
    messageDiv.dataset.index = currentConversation.length - 1;
    scrollToBottom();

    if (typeof saveCurrentChat === 'function') {
        saveCurrentChat();
    }
}

/**
 * Helper to generate message HTML string (DRY principle)
 */
function createMessageHTML(text, sender, bubbleId = null) {
    const isAI = sender === 'ai';
    const content = (isAI && window.marked) ? marked.parse(text) : text;
    const idAttr = bubbleId ? `id="${bubbleId}"` : '';

    // Actions block (Copy/Edit)
    let actionsHTML = `
        <div class="message-actions">
            <button class="message-action-btn" title="Copy" onclick="handleCopy(this)">
                <i class="far fa-copy"></i>
            </button>`;

    if (sender === 'user') {
        actionsHTML += `
            <button class="message-action-btn" title="Edit" onclick="handleEdit(this)">
                <i class="fas fa-pencil-alt"></i>
            </button>`;
    }

    actionsHTML += `</div>`;

    return `
        <div class="bubble-wrapper ${sender}">
            <div class="message-bubble ${sender}" ${idAttr}>${content}</div>
            ${actionsHTML}
        </div>
    `;
}

// Global handlers for buttons (works after innerHTML replacement)
window.handleCopy = function (btn) {
    const bubble = btn.closest('.bubble-wrapper').querySelector('.message-bubble');
    const text = bubble.innerText || bubble.textContent;
    navigator.clipboard.writeText(text);

    const icon = btn.querySelector('i');
    icon.className = 'fas fa-check';
    setTimeout(() => { icon.className = 'far fa-copy'; }, 2000);
};

window.handleEdit = function (btn) {
    const messageDiv = btn.closest('.chat-message');
    const bubble = messageDiv.querySelector('.message-bubble');
    const text = bubble.innerText || bubble.textContent;
    showInlineEdit(messageDiv, bubble, text);
};

// ============================================
// INLINE EDIT FUNCTIONALITY
// ============================================

function showInlineEdit(messageDiv, bubble, originalText) {
    // Add editing class to hide everything else via CSS
    messageDiv.classList.add('editing');

    // Hide original bubble and actions explicitly too
    const wrapper = messageDiv.querySelector('.bubble-wrapper');
    const actions = messageDiv.querySelector('.message-actions');
    if (bubble) bubble.style.display = 'none';
    if (actions) actions.style.display = 'none';

    // Create edit container
    const editContainer = document.createElement('div');
    editContainer.className = 'inline-edit-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'inline-edit-textarea';
    textarea.value = originalText;

    const footer = document.createElement('div');
    footer.className = 'inline-edit-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'inline-edit-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
        editContainer.remove();
        if (bubble) bubble.style.display = 'block';
        if (actions) actions.style.display = 'flex';
        messageDiv.classList.remove('editing');
    };

    const sendBtn = document.createElement('button');
    sendBtn.className = 'inline-edit-btn send';
    sendBtn.textContent = 'Send';
    sendBtn.onclick = async () => {
        const newText = textarea.value.trim();
        if (!newText || newText === originalText) {
            cancelBtn.click();
            return;
        }

        // 1. Restore the original bubble (non-destructive UI)
        editContainer.remove();
        bubble.textContent = originalText; // Revert to original text!
        bubble.style.display = 'block';
        if (actions) actions.style.display = 'flex';
        messageDiv.classList.remove('editing');

        // 2. Trigger sendMessage as a NEW prompt at the end
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = newText;
            sendMessage();
        }
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(sendBtn);
    editContainer.appendChild(textarea);
    editContainer.appendChild(footer);
    wrapper.appendChild(editContainer);

    textarea.focus();
    // Auto-resize textarea
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    });
}

function appendLoader() {
    let chatBox = document.getElementById('chatMessages');
    if (!chatBox) return null;

    const loaderId = 'loader-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ai loader-msg`;
    messageDiv.id = loaderId;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ai loading-bubble`;
    bubble.innerHTML = `<div class="typing-indicator"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;

    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);
    scrollToBottom();

    return loaderId;
}

function removeLoader(loaderId) {
    if (!loaderId) return;
    const loaderEl = document.getElementById(loaderId);
    if (loaderEl) {
        loaderEl.remove();
    }
}

function scrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        // With scroll-behavior: smooth in CSS, this will animate automatically
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}
// ============================================

function setupSettings() {

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', function (e) {
            e.preventDefault();
            settingsDropdown.classList.toggle('show');
        });

        document.addEventListener('click', function (e) {
            if (!settingsBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
                settingsDropdown.classList.remove('show');
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

                // Clear ALL user related data
                const user = window.currentUserData;
                if (user && user.email) {
                    localStorage.removeItem(`finclarityChats_${user.email}`);
                    localStorage.removeItem(`finclarityMemory_${user.email}`);
                }
                localStorage.removeItem('finclarityChats');
                localStorage.removeItem('finclarityMemory');
                localStorage.removeItem('currentUser');

                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-')) {
                        localStorage.removeItem(key);
                    }
                });

                window.location.href = '/login';

            } catch (error) {
                console.error('Logout error:', error);
                alert('Error logging out.');
            }
        });
    }
}

// ============================================
// CHAT HISTORY MANAGEMENT
// ============================================

let chatHistories = [];
let currentChatId = null;
let currentConversation = [];

function getUserKey(baseKey) {
    const user = window.currentUserData;
    if (user && user.email) {
        return `${baseKey}_${user.email}`;
    }
    if (user && user.isGuest) {
        return `${baseKey}_guest`;
    }
    return baseKey;
}

function loadLocalChats() {
    try {
        const stored = localStorage.getItem(getUserKey('finclarityChats'));
        if (stored) {
            chatHistories = JSON.parse(stored);

            // Sort: Pinned first, then by ID (timestamp) descending
            chatHistories.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return b.id - a.id;
            });

            const historyList = document.querySelector('.history-list');
            if (historyList) {
                historyList.innerHTML = '';
                chatHistories.forEach(chat => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    if (chat.id === currentChatId) historyItem.classList.add('active');
                    historyItem.dataset.chatId = chat.id;

                    historyItem.innerHTML = `
                        <i class="fas ${chat.isPinned ? 'fa-thumbtack' : 'fa-comment'}" style="${chat.isPinned ? 'color: var(--primary-600); transform: rotate(45deg);' : ''}"></i>
                        <span class="history-item-title">${chat.title}</span>
                        <div class="history-item-actions">
                            <button class="history-more-btn" onclick="toggleHistoryMenu(event, '${chat.id}')">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="history-dropdown" id="dropdown-${chat.id}">
                                <div class="history-dropdown-item" onclick="handlePinChat(event, '${chat.id}')">
                                    <i class="fas fa-thumbtack"></i> ${chat.isPinned ? 'Unpin' : 'Pin'}
                                </div>
                                <div class="history-dropdown-item" onclick="handleRenameChat(event, '${chat.id}')">
                                    <i class="fas fa-edit"></i> Rename
                                </div>
                                <div class="history-dropdown-item danger" onclick="handleDeleteChat(event, '${chat.id}')">
                                    <i class="fas fa-trash-alt"></i> Delete
                                </div>
                            </div>
                        </div>
                    `;

                    historyItem.addEventListener('click', (e) => {
                        // If we are currently renaming, don't trigger chat loading
                        if (historyItem.classList.contains('renaming')) return;

                        if (!e.target.closest('.history-item-actions')) {
                            loadChat(chat.id);
                        }
                    });
                    historyList.appendChild(historyItem);
                });
            }
        } else {
            chatHistories = [];
            const historyList = document.querySelector('.history-list');
            if (historyList) historyList.innerHTML = '';
        }
    } catch (e) {
        console.error("Local chats load error:", e);
    }
}

function saveLocalChats() {
    localStorage.setItem(getUserKey('finclarityChats'), JSON.stringify(chatHistories));
    if (typeof syncUserDataToBackend === 'function') syncUserDataToBackend();
}

function saveCurrentChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const firstUserMsgDiv = chatMessages.querySelector('.chat-message.user');
    if (!firstUserMsgDiv) return;

    const bubble = firstUserMsgDiv.querySelector('.message-bubble');
    const title = bubble ? bubble.textContent.trim() : firstUserMsgDiv.textContent.trim();
    const shortTitle = title.length > 25 ? title.substring(0, 25) + "..." : title;

    if (currentChatId) {
        const chatData = chatHistories.find(c => c.id === currentChatId);
        if (chatData) {
            chatData.html = chatMessages.innerHTML;
            chatData.messages = [...currentConversation];
            // Don't auto-update title if it's already set (to preserve renames)
            if (!chatData.title) chatData.title = shortTitle;
        }
    } else {
        currentChatId = Date.now().toString();
        chatHistories.push({
            id: currentChatId,
            title: shortTitle,
            html: chatMessages.innerHTML,
            messages: [...currentConversation],
            isPinned: false
        });
    }

    saveLocalChats();
    // Refresh the whole list to maintain sort order or update titles
    loadLocalChats();
}

function loadChat(chatId) {
    saveCurrentChat();

    currentChatId = chatId;
    const chatData = chatHistories.find(c => c.id === currentChatId);
    if (!chatData) return;

    currentConversation = [...(chatData.messages || [])];

    const chatMessages = document.getElementById('chatMessages');
    const newChatArea = document.getElementById('newChatArea');

    if (chatMessages) {
        chatMessages.innerHTML = chatData.html;
    }
    if (newChatArea) {
        newChatArea.style.display = 'none';
    }

    updateActiveHistoryItem();
}

function updateActiveHistoryItem() {
    const items = document.querySelectorAll('.history-item');
    items.forEach(item => {
        if (item.dataset.chatId === currentChatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function toggleHistoryMenu(event, chatId) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${chatId}`);

    // Close all other dropdowns
    document.querySelectorAll('.history-dropdown').forEach(d => {
        if (d.id !== `dropdown-${chatId}`) d.classList.remove('show');
    });

    if (dropdown) dropdown.classList.toggle('show');
}

function handlePinChat(event, chatId) {
    event.stopPropagation();
    const chat = chatHistories.find(c => c.id === chatId);
    if (chat) {
        chat.isPinned = !chat.isPinned;
        saveLocalChats();
        loadLocalChats();
    }
}

function handleRenameChat(event, chatId) {
    event.stopPropagation();
    const historyItem = document.querySelector(`.history-item[data-chat-id="${chatId}"]`);
    if (!historyItem) return;

    const titleSpan = historyItem.querySelector('.history-item-title');
    const originalTitle = titleSpan.textContent;

    // Hide actions and title, show input
    historyItem.classList.add('renaming');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'history-rename-input';
    input.value = originalTitle;

    const actions = document.createElement('div');
    actions.className = 'history-rename-controls';
    actions.innerHTML = `
        <button class="rename-confirm-btn"><i class="fas fa-check"></i></button>
        <button class="rename-cancel-btn"><i class="fas fa-times"></i></button>
    `;

    const oldContent = historyItem.innerHTML;
    // We only replace the title area part conceptually, but for simplicity we swap children
    historyItem.innerHTML = '';
    historyItem.appendChild(input);
    historyItem.appendChild(actions);

    input.focus();
    input.select();

    const saveRename = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== originalTitle) {
            const chat = chatHistories.find(c => c.id === chatId);
            if (chat) {
                chat.title = newTitle;
                saveLocalChats();
            }
        }
        loadLocalChats();
    };

    const cancelRename = () => {
        loadLocalChats();
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') cancelRename();
    };

    actions.querySelector('.rename-confirm-btn').onclick = (e) => {
        e.stopPropagation();
        saveRename();
    };
    actions.querySelector('.rename-cancel-btn').onclick = (e) => {
        e.stopPropagation();
        cancelRename();
    };
}

function handleDeleteChat(event, chatId) {
    event.stopPropagation();
    const modal = document.getElementById('deleteChatModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn1 = document.getElementById('cancelDeleteBtn');
    const cancelBtn2 = document.getElementById('cancelDeleteBtn2');

    if (!modal) {
        // Fallback if modal not found
        if (confirm("Are you sure you want to delete this chat?")) {
            executeDelete(chatId);
        }
        return;
    }

    modal.classList.add('show');

    const closeModal = () => modal.classList.remove('show');

    // Remove old listeners to avoid multiple deletions
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

    newConfirm.onclick = () => {
        executeDelete(chatId);
        closeModal();
    };

    cancelBtn1.onclick = closeModal;
    cancelBtn2.onclick = closeModal;
}

function executeDelete(chatId) {
    chatHistories = chatHistories.filter(c => c.id !== chatId);
    if (currentChatId === chatId) {
        currentChatId = null;
        currentConversation = [];
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('newChatArea').style.display = 'block';
    }
    saveLocalChats();
    loadLocalChats();
}

// Global listener to close history dropdowns
document.addEventListener('click', function () {
    document.querySelectorAll('.history-dropdown').forEach(d => d.classList.remove('show'));
});

function startNewChat() {
    saveCurrentChat();

    currentChatId = null;
    currentConversation = [];
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }

    const newChatArea = document.getElementById('newChatArea');
    if (newChatArea) {
        newChatArea.style.display = 'block';
    }

    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    if (welcomeSubtitle) {
        welcomeSubtitle.textContent = "Here's your financial overview";
    }

    updateActiveHistoryItem();
}

// ============================================
// USER DATA
// ============================================

async function loadUserData() {

    return fetch('/api/user', {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(async data => {
            if (data.status === 'success') {
                window.currentUserData = data.user;
                console.log("User data loaded:", window.currentUserData);

                // Fetch persistent chat data
                if (!window.currentUserData.isGuest) {
                    try {
                        const syncRes = await fetch('/api/get_userdata', { credentials: 'include' });
                        const syncData = await syncRes.json();
                        if (syncData.status === 'success' && syncData.data) {
                            // Always sync with backend data if available. Overwrite local if we have fresh data.
                            const chats = syncData.data.chats || [];
                            const memory = syncData.data.memory || [];

                            localStorage.setItem(getUserKey('finclarityChats'), JSON.stringify(chats));
                            localStorage.setItem(getUserKey('finclarityMemory'), JSON.stringify(memory));
                            financeData = sanitizeFinanceData(syncData.data.finance_data);

                            // Re-load chats into the local state
                            if (typeof loadLocalChats === 'function') loadLocalChats();
                            renderFinanceModuleViews();
                        }
                    } catch (e) {
                        console.error("Failed to load user data from backend", e);
                    }
                } else {
                    financeData = sanitizeFinanceData();
                    renderFinanceModuleViews();
                }
            }
        })
        .catch(err => {
            console.warn('Error loading user data, checking localStorage:', err);

            const localUser = localStorage.getItem('currentUser');
            if (localUser) {
                window.currentUserData = JSON.parse(localUser);
                console.log("Using local user data:", window.currentUserData);
                // Also render finance view for local data if guest
                if (window.currentUserData.isGuest) {
                    financeData = sanitizeFinanceData();
                    renderFinanceModuleViews();
                }
            } else {
                // Default to guest
                window.currentUserData = { isGuest: true, name: "Guest" };
                financeData = sanitizeFinanceData();
                renderFinanceModuleViews();
            }
        });
}

/**
 * Handle UI for guest users
 */
function checkGuestAccess() {
    if (window.currentUserData && window.currentUserData.isGuest) {
        const area = document.getElementById("newChatArea");
        if (area) {
            area.innerHTML = `
                <div class="guest-ui-wrapper" style="text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px dashed var(--border-color);">
                    <i class="fas fa-lock" style="font-size: 48px; color: var(--primary-600); margin-bottom: 20px; display: block;"></i>
                    <h2 style="margin-bottom: 10px; color: var(--text-primary);">Login Required</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">Please sign in to use AI Assistant</p>
                    <button class="btn-primary" onclick="window.location.href='/login'" style="padding: 12px 32px; border-radius: 12px; cursor: pointer; border: none; font-weight: 600;">
                        Sign In
                    </button>
                </div>
            `;
            // Also disable input to prevent accidents
            const input = document.getElementById('chatInput');
            const sendBtn = document.getElementById('sendBtn');
            if (input) {
                input.disabled = true;
                input.placeholder = "Login to chat with AI...";
            }
            if (sendBtn) sendBtn.disabled = true;
        }
    }
}

// ============================================
// DATA SYNC HELPER
// ============================================

async function syncUserDataToBackend() {
    if (!window.currentUserData || window.currentUserData.isGuest) return;
    try {
        const chats = JSON.parse(localStorage.getItem(getUserKey('finclarityChats')) || '[]');
        const memory = JSON.parse(localStorage.getItem(getUserKey('finclarityMemory')) || '[]');
        await fetch('/api/sync_userdata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ chats, memory, finance_data: financeData })
        });
    } catch (e) {
        console.error("Failed to sync data to backend", e);
    }
}


// ============================================
// PLACEHOLDERS
// ============================================

function setupSidebarCollapse() {
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    const collapseBtn = document.getElementById('sidebarCollapseBtn');

    if (!sidebar || !container || !collapseBtn) return;

    // Load initial state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        container.classList.add('collapsed');
    }

    collapseBtn.addEventListener('click', () => {
        const currentlyCollapsed = sidebar.classList.toggle('collapsed');
        container.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', currentlyCollapsed);
    });
}

function setupNavigation() {
    const navItems = {
        'navHome': { view: 'mainView', title: 'Home', action: resetToHome },
        'navCompare': { view: 'compareView', title: 'Smart Comparison', action: () => { switchToView('compareView', 'Smart Comparison'); generateComparisonTable(); } },
        'navWhatChanged': { view: 'whatChangedView', title: "What's Changed?", action: () => { switchToView('whatChangedView', "What's Changed?"); populateWhatChangedView(); } },
        'navTodo': { view: 'todoView', title: 'Financial To-Do List', action: () => openFinanceView('todoView', 'Financial To-Do List') },
        'navSuggestions': { view: 'suggestionsView', title: 'Smart Suggestions', action: () => openFinanceView('suggestionsView', 'Smart Suggestions') },
        'navCalculators': { view: 'calculatorsView', title: 'Financial Calculators', action: renderCalculatorsHub }
    };

    Object.keys(navItems).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                navItems[id].action();
            });
        }
    });
}

function resetToHome() {
    // Clear stack except home
    navStack = [{ id: 'mainView', title: 'Home' }];
    renderBreadcrumb();

    // Hide all views, show main
    document.querySelectorAll('.main-content > div').forEach(v => {
        if (v.id === 'mainView' || v.classList.contains('dashboard-header-simple')) {
            v.classList.remove('hidden');
            v.style.opacity = 1;
            v.style.transform = 'translateY(0)';
        } else {
            v.classList.add('hidden');
        }
    });

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('navHome').classList.add('active');
}

function switchToView(viewId, title) {
    navStack = [{ id: viewId, title: title }];
    renderBreadcrumb();

    document.querySelectorAll('.main-content > div').forEach(v => {
        if (v.id === viewId || v.classList.contains('dashboard-header-simple')) {
            v.classList.remove('hidden');
            v.style.opacity = 0;
            v.style.transform = 'translateY(10px)';
            setTimeout(() => {
                v.style.opacity = 1;
                v.style.transform = 'translateY(0)';
            }, 50);
        } else {
            v.classList.add('hidden');
        }
    });

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navByView = {
        compareView: 'navCompare',
        whatChangedView: 'navWhatChanged',
        todoView: 'navTodo',
        suggestionsView: 'navSuggestions',
        calculatorsView: 'navCalculators',
        mainView: 'navHome'
    };
    const navId = navByView[viewId];
    if (navId && document.getElementById(navId)) {
        document.getElementById(navId).classList.add('active');
    }
    if (viewId === 'compareView') {
        generateComparisonTable();
    }
}

function sanitizeFinanceData(raw = {}) {
    return {
        todos: Array.isArray(raw.todos) ? raw.todos : []
    };
}

function formatINR(value) {
    const safe = Number(value) || 0;
    return `Rs ${safe.toLocaleString('en-IN')}`;
}

async function openFinanceView(viewId, title) {
    renderFinanceModuleViews();
    switchToView(viewId, title);
}

function showFinanceActionModal(options = {}) {
    const {
        title = 'Action',
        message = 'Please review this action.',
        confirmText = 'Continue',
        cancelText = 'Cancel',
        destructive = false,
        hideCancel = false
    } = options;

    const modal = document.getElementById('financeActionModal');
    const titleEl = document.getElementById('financeActionTitle');
    const bodyEl = document.getElementById('financeActionBody');
    const confirmBtn = document.getElementById('financeActionConfirmBtn');
    const cancelBtn = document.getElementById('financeActionCancelBtn');
    const closeBtn = document.getElementById('financeActionCloseBtn');
    if (!modal || !titleEl || !bodyEl || !confirmBtn || !cancelBtn || !closeBtn) {
        return Promise.resolve(true);
    }

    titleEl.innerHTML = `<i class="fas ${destructive ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> ${title}`;
    bodyEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    confirmBtn.classList.toggle('btn-danger', destructive);
    confirmBtn.classList.toggle('btn-primary', !destructive);
    cancelBtn.style.display = hideCancel ? 'none' : 'inline-flex';
    modal.classList.add('show');

    return new Promise(resolve => {
        let done = false;
        const cleanup = () => {
            modal.classList.remove('show');
            modal.removeEventListener('click', onOverlayClick);
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
        };
        const finish = (value) => {
            if (done) return;
            done = true;
            cleanup();
            resolve(value);
        };
        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);
        const onOverlayClick = (event) => {
            if (event.target === modal) finish(false);
        };
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onOverlayClick);
    });
}

function renderFinanceModuleViews() {
    renderTodoView();
    renderSuggestionsView();
}

async function createTodoTask(payload) {
    const res = await fetch('/api/finance_todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Failed to add task');
    financeData = sanitizeFinanceData(data.data);
}

async function updateTodoTask(taskId, payload) {
    const res = await fetch(`/api/finance_todos/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Failed to update task');
    financeData = sanitizeFinanceData(data.data);
}

async function deleteTodoTask(taskId) {
    const res = await fetch(`/api/finance_todos/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Failed to delete task');
    financeData = sanitizeFinanceData(data.data);
}

async function persistFinanceData() {
    const res = await fetch('/api/finance_data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(financeData)
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Failed to save finance data');
    financeData = sanitizeFinanceData(data.data);
}

function renderTodoView() {
    const view = document.getElementById('todoView');
    if (!view) return;
    const tasks = financeData.todos || [];
    const pendingCount = tasks.filter(task => !task.completed).length;
    const completedCount = tasks.length - pendingCount;

    view.innerHTML = `
        <section class="finance-module-card">
            <div class="finance-module-header">
                <h3>Personalized Financial To-Do List</h3>
                <p>Keep your tasks in sync securely across sessions.</p>
                <p class="finance-module-hint">Need help with a specific task? Check the Smart Suggestions tab for focused tips.</p>
            </div>
            <div class="finance-kpi-row">
                <div class="finance-kpi"><span>Pending</span><strong>${pendingCount}</strong></div>
                <div class="finance-kpi"><span>Completed</span><strong>${completedCount}</strong></div>
                <div class="finance-kpi"><span>Total</span><strong>${tasks.length}</strong></div>
            </div>
            <form id="todoForm" class="finance-form" autocomplete="off">
                <input type="hidden" id="todoTaskId">
                <input type="text" id="todoTitle" placeholder="Task title (e.g. Increase SIP by ₹2,000)" required autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                <input type="date" id="todoDueDate" autocomplete="off">
                <input type="text" id="todoNotes" placeholder="Notes (optional)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                <button type="submit" class="btn-primary">Save Task</button>
            </form>
            <div class="finance-list">
                ${tasks.length ? tasks.map(task => `
                    <div class="finance-list-item ${task.completed ? 'done' : ''}">
                        <label>
                            <input type="checkbox" class="todo-toggle todo-circle-toggle" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                            <span class="finance-list-title">${task.title}</span>
                        </label>
                        <span class="finance-list-meta">${task.dueDate ? `Due ${task.dueDate}` : 'No due date'}</span>
                        <p>${task.notes || ''}</p>
                        <div class="finance-list-actions">
                            <button class="btn-outline todo-edit" data-id="${task.id}">Edit</button>
                            <button class="btn-danger-outline todo-delete" data-id="${task.id}">Delete</button>
                        </div>
                    </div>
                `).join('') : '<p class="finance-empty-state">No tasks yet. Add your first financial action.</p>'}
            </div>
        </section>
    `;

    const todoForm = document.getElementById('todoForm');
    if (todoForm) {
        todoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = document.getElementById('todoTaskId').value;
            const payload = {
                title: document.getElementById('todoTitle').value.trim(),
                dueDate: document.getElementById('todoDueDate').value,
                notes: document.getElementById('todoNotes').value.trim()
            };
            if (!payload.title) return;
            try {
                if (taskId) {
                    await updateTodoTask(taskId, payload);
                } else {
                    await createTodoTask(payload);
                }
                renderFinanceModuleViews();
                showFinanceActionModal({
                    title: 'Saved',
                    message: 'Your task is saved and synced to your account.',
                    confirmText: 'Okay',
                    hideCancel: true
                });
            } catch (error) {
                showFinanceActionModal({
                    title: 'Save Failed',
                    message: error.message || 'Unable to save task.',
                    confirmText: 'Okay',
                    hideCancel: true,
                    destructive: true
                });
            }
        });
    }

    view.querySelectorAll('.todo-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            try {
                await updateTodoTask(e.target.dataset.id, { completed: e.target.checked });
                renderFinanceModuleViews();
            } catch (error) {
                showFinanceActionModal({
                    title: 'Update Failed',
                    message: error.message || 'Unable to update task.',
                    confirmText: 'Okay',
                    hideCancel: true,
                    destructive: true
                });
            }
        });
    });

    view.querySelectorAll('.todo-edit').forEach(button => {
        button.addEventListener('click', (e) => {
            const task = (financeData.todos || []).find(item => item.id === e.target.dataset.id);
            if (!task) return;
            document.getElementById('todoTaskId').value = task.id;
            document.getElementById('todoTitle').value = task.title || '';
            document.getElementById('todoDueDate').value = task.dueDate || '';
            document.getElementById('todoNotes').value = task.notes || '';
            document.getElementById('todoTitle').focus();
        });
    });

    view.querySelectorAll('.todo-delete').forEach(button => {
        button.addEventListener('click', async (e) => {
            const shouldDelete = await showFinanceActionModal({
                title: 'Delete Task',
                message: 'Are you sure you want to delete this task? This action cannot be undone.',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                destructive: true
            });
            if (!shouldDelete) return;
            try {
                await deleteTodoTask(e.target.dataset.id);
                renderFinanceModuleViews();
                showFinanceActionModal({
                    title: 'Task Deleted',
                    message: 'The task has been removed successfully.',
                    confirmText: 'Okay',
                    hideCancel: true
                });
            } catch (error) {
                showFinanceActionModal({
                    title: 'Delete Failed',
                    message: error.message || 'Unable to delete task.',
                    confirmText: 'Okay',
                    hideCancel: true,
                    destructive: true
                });
            }
        });
    });
}

function renderSuggestionsView() {
    const view = document.getElementById('suggestionsView');
    if (!view) return;
    const suggestions = generateSmartSuggestions();
    const highImpactCount = suggestions.filter(item => item.priority === 'High').length;
    const quickWinsCount = suggestions.filter(item => item.priority === 'Quick Win').length;

    view.innerHTML = `
        <section class="finance-module-card">
            <div class="finance-module-header">
                <h3>Smart Suggestions</h3>
                <p>Actionable moves generated from your to-do activity.</p>
            </div>
            <div class="smart-suggest-top">
                <div class="smart-suggest-stat">
                    <span>High Impact</span>
                    <strong>${highImpactCount}</strong>
                </div>
                <div class="smart-suggest-stat">
                    <span>Quick Win</span>
                    <strong>${quickWinsCount}</strong>
                </div>
                <div class="smart-suggest-stat">
                    <span>Total Moves</span>
                    <strong>${suggestions.length}</strong>
                </div>
            </div>
            <div class="smart-suggest-grid">
                ${suggestions.map(item => `
                    <article class="smart-suggest-card">
                        <div class="smart-card-head">
                            <span class="smart-priority smart-priority-${item.priority.toLowerCase().replace(/\s+/g, '-')}">${item.priority}</span>
                            <h4>${item.title}</h4>
                        </div>
                        <p class="smart-insight">${item.tip}</p>
                        <ul class="smart-steps">
                            ${item.steps.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function generateSmartSuggestions() {
    const suggestions = [];
    const todos = financeData.todos || [];
    const pendingTodos = todos.filter(todo => !todo.completed);
    const completedTodos = todos.filter(todo => todo.completed);

    if (pendingTodos.length > 0) {
        const nextTask = pendingTodos[0];
        const dueSoon = pendingTodos
            .filter(task => task.dueDate)
            .map(task => ({ ...task, days: Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) }))
            .filter(task => task.days >= 0 && task.days <= 7)
            .sort((a, b) => a.days - b.days);

        suggestions.push({
            title: 'Execution Sprint',
            priority: 'Quick Win',
            tip: `${pendingTodos.length} pending tasks. Start with "${nextTask.title}" for immediate momentum.`,
            steps: [
                'Spend 15 focused minutes on the first task only.',
                'After completion, instantly mark it done here.',
                'Then pick the next highest-impact pending task.'
            ]
        });

        if (dueSoon.length > 0) {
            suggestions.push({
                title: 'Due Date Protection',
                priority: 'High',
                tip: `${dueSoon.length} task(s) are due within 7 days. Prevent last-minute stress.`,
                steps: [
                    `Start with "${dueSoon[0].title}" due in ${Math.max(0, dueSoon[0].days)} day(s).`,
                    'Move low-urgency tasks to next week.',
                    'Close at least one due task before tonight.'
                ]
            });
        }
    }

    if (completedTodos.length > 0) {
        const completionRate = Math.round((completedTodos.length / Math.max(1, todos.length)) * 100);
        suggestions.push({
            title: 'Consistency Booster',
            priority: 'Quick Win',
            tip: `Your task completion rate is ${completionRate}%. Maintain this streak for compounding discipline.`,
            steps: [
                'Keep daily target: close one financial task per day.',
                'Batch easy tasks into a single 20-minute slot.',
                'Review completed wins every weekend.'
            ]
        });
    }

    while (suggestions.length < 4) {
        suggestions.push({
            title: 'Foundation Move',
            priority: 'Quick Win',
            tip: 'Create one concrete money move now, then we will keep optimizing your plan.',
            steps: [
                'Add one to-do linked to a real account action.',
                'Set a due date so it does not slip.',
                'Return here to get your refreshed next-step strategy.'
            ]
        });
    }

    return suggestions.slice(0, 4);
}

const productsData = {
    "cards": [
        {
            id: "card_hdfc_regalia",
            category: "Cards",
            provider: "HDFC",
            name: "HDFC Regalia Gold",
            icon: "fas fa-crown",
            details: {
                "Joining Fee": "₹2,500 + GST",
                "Annual Fee": "₹2,500 (Waived on ₹4L spend)",
                "Reward Rate": "4 Points per ₹150",
                "Lounge Access": "12 Domestic + 6 Intl",
                "Forex Markup": "2% + GST",
                "Milestones": "₹5,000 Voucher on ₹5L spend",
                "Best For": "Premium Lifestyle & Travel"
            },
            recommended: true
        },
        {
            id: "card_axis_atlas",
            category: "Cards",
            provider: "AXIS",
            name: "AXIS Atlas",
            icon: "fas fa-plane",
            details: {
                "Joining Fee": "₹5,000 + GST",
                "Annual Fee": "₹5,000 (5,000 Edge Miles reward)",
                "Reward Rate": "5% (Edge Miles) on Travel",
                "Lounge Access": "Unlimited Domestic + 8 Intl",
                "Forex Markup": "3.5% + GST",
                "Milestones": "Up to 10,000 Miles on Spends",
                "Best For": "Frequent Flyers"
            },
            recommended: false
        },
        {
            id: "card_sbi_cashback",
            category: "Cards",
            provider: "SBI",
            name: "SBI Cashback Card",
            icon: "fas fa-wallet",
            details: {
                "Joining Fee": "₹999 + GST",
                "Annual Fee": "₹999 (Waived on ₹2L spend)",
                "Reward Rate": "5% Unlimited Cashback (Online)",
                "Lounge Access": "None",
                "Forex Markup": "3.5% + GST",
                "Milestones": "Fuel Surcharge Waiver",
                "Best For": "Online Shopping"
            },
            recommended: false
        },
        {
            id: "card_icici_amazon",
            category: "Cards",
            provider: "ICICI",
            name: "Amazon Pay ICICI",
            icon: "fab fa-amazon",
            details: {
                "Joining Fee": "Lifetime Free (₹0)",
                "Annual Fee": "Lifetime Free (₹0)",
                "Reward Rate": "5% for Prime Customers",
                "Lounge Access": "None",
                "Forex Markup": "3.5% + GST",
                "Milestones": "Unlimited Earnings",
                "Best For": "Amazon Loyalists"
            },
            recommended: false
        }
    ],
    "insurance": [
        {
            id: "ins_star_health",
            category: "Insurance",
            provider: "Star Health",
            name: "Star Health Comprehensive",
            icon: "fas fa-heartbeat",
            details: {
                "Sum Insured": "₹5L - ₹1Cr",
                "Premium": "Starts at ₹12,000/yr",
                "Waiting Period": "36 Months (PED)",
                "No Claim Bonus": "Up to 100%",
                "Restoration": "100% Automatic",
                "OPD Cover": "Included up to ₹5,000",
                "Best For": "Family Floater"
            },
            recommended: true
        },
        {
            id: "ins_hdfc_life",
            category: "Insurance",
            provider: "HDFC Life",
            name: "HDFC Life Click 2 Protect",
            icon: "fas fa-user-shield",
            details: {
                "Sum Insured": "₹50L - ₹10Cr",
                "Premium": "Starts at ₹18,000/yr",
                "Policy Term": "Up to 85 Years",
                "Riders": "Critical Illness, ADR",
                "Death Benefit": "Lump sum or Income",
                "Claim Ratio": "99.3%",
                "Best For": "Term Life Protection"
            },
            recommended: false
        }
    ],
    "savings": [
        {
            id: "sav_kotak_811",
            category: "Savings",
            provider: "Kotak",
            name: "Kotak 811",
            icon: "fas fa-piggy-bank",
            details: {
                "Min Balance": "Zero Balance",
                "Interest Rate": "Up to 7% p.a.",
                "Debit Card": "Virtual (Free)",
                "Account Type": "Full Digital",
                "Mobile App": "Industry Leading",
                "ATM Access": "Any ATM",
                "Best For": "Digital Savvy Users"
            },
            recommended: true
        },
        {
            id: "sav_idfc_first",
            category: "Savings",
            provider: "IDFC First",
            name: "IDFC First Savings",
            icon: "fas fa-vault",
            details: {
                "Min Balance": "₹25,000 (Average)",
                "Interest Rate": "Up to 7.25% p.a.",
                "Debit Card": "Visa Infinite",
                "Lounge Access": "Airport Lounges Included",
                "Monthly Credit": "Interest Paid Monthly",
                "Cashback": "On Merchant Spends",
                "Best For": "High Interest Seekers"
            },
            recommended: false
        }
    ]
};

function setupComparisonFeature() {
    const productSearch = document.getElementById('productSearch');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const clearBtn = document.getElementById('clearCompareBtn');
    const trayCompareBtn = document.getElementById('trayCompareBtn');

    if (productSearch && searchSuggestions) {
        productSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                searchSuggestions.classList.remove('show');
                return;
            }

            let matches = [];
            Object.values(productsData).forEach(categoryProducts => {
                categoryProducts.forEach(p => {
                    if (p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)) {
                        matches.push(p);
                    }
                });
            });

            if (matches.length > 0) {
                searchSuggestions.innerHTML = matches.map(p => `
                    <div class="suggestion-item" onclick="toggleSelection('${p.id}')">
                        <i class="${p.icon}"></i>
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">${p.name}</div>
                            <div style="font-size: 11px; color: var(--text-tertiary);">${p.category}</div>
                        </div>
                    </div>
                `).join('');
                searchSuggestions.classList.add('show');
            } else {
                searchSuggestions.classList.remove('show');
            }
        });
    }

    if (trayCompareBtn) {
        trayCompareBtn.addEventListener('click', () => {
            switchToView('compareView', 'Smart Comparison');
            generateComparisonTable();
        });
    }

    // Close suggestions on blur
    document.addEventListener('click', (e) => {
        if (productSearch && !productSearch.contains(e.target)) {
            searchSuggestions?.classList.remove('show');
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', clearSelection);
    }
}

window.toggleSelection = function (productId) {
    const index = comparisonList.indexOf(productId);
    if (index === -1) {
        if (comparisonList.length >= 3) {
            alert("You can only select up to 3 products at a time.");
            return;
        }
        comparisonList.push(productId);
    } else {
        comparisonList.splice(index, 1);
    }

    updateSelectionTray();

    // Auto-update table if we are already in compare view
    const compareView = document.getElementById('compareView');
    if (compareView && !compareView.classList.contains('hidden')) {
        generateComparisonTable();
    }

    // Update any "Select" buttons in the UI if visible
    document.querySelectorAll(`.select-product-btn[data-id="${productId}"]`).forEach(btn => {
        btn.classList.toggle('selected', comparisonList.includes(productId));
        btn.textContent = comparisonList.includes(productId) ? 'Selected' : 'Select';
    });
};

function updateSelectionTray() {
    const tray = document.getElementById('comparisonTray');
    const countEl = document.getElementById('selectedCount');
    const previewsEl = document.getElementById('trayPreviews');
    const dashboardContainer = document.querySelector('.dashboard-container');

    if (!tray || !countEl || !previewsEl) return;

    countEl.textContent = comparisonList.length;

    // Hide tray if we are already in the comparison view OR if list is empty
    const compareView = document.getElementById('compareView');
    const isInCompareView = compareView && !compareView.classList.contains('hidden');

    if (comparisonList.length > 0 && !isInCompareView) {
        // Tray removed as per user request
        tray.classList.remove('show');
        dashboardContainer.classList.remove('has-tray');
    } else {
        tray.classList.remove('show');
        dashboardContainer.classList.remove('has-tray');
        previewsEl.innerHTML = '';
    }
}

window.clearSelection = function () {
    comparisonList = [];
    updateSelectionTray();
    document.querySelectorAll('.select-product-btn').forEach(btn => {
        btn.classList.remove('selected');
        btn.textContent = 'Select';
    });
    const tableContainer = document.getElementById('compareTableContainer');
    if (tableContainer) tableContainer.innerHTML = '';
    const emptyState = document.getElementById('compareEmptyState');
    if (emptyState) emptyState.classList.remove('hidden');
};

function findProductById(id) {
    for (const cat of Object.values(productsData)) {
        const found = cat.find(p => p.id === id);
        if (found) return found;
    }
    return null;
}

function generateComparisonTable() {
    console.log("Generating comparison table for:", comparisonList);
    const tableContainer = document.getElementById('compareTableContainer');
    const emptyState = document.getElementById('compareEmptyState');
    const compareGrid = document.getElementById('compareGrid');

    if (!tableContainer || !emptyState) return;

    if (comparisonList.length === 0) {
        tableContainer.innerHTML = '';
        if (compareGrid) compareGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        renderCompareCategoryGrid();
        return;
    }

    emptyState.classList.add('hidden');

    const selectedProducts = comparisonList.map(id => findProductById(id)).filter(p => p);

    // 1. Show Card Preview (always show cards)
    if (compareGrid) {
        compareGrid.innerHTML = selectedProducts.map(item => `
            <div class="compare-card ${item.recommended ? 'recommended' : ''}">
                ${item.recommended ? '<div class="recommended-badge">Recommended</div>' : ''}
                <button class="remove-card-btn" onclick="toggleSelection('${item.id}')" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
                <div class="compare-card-header">
                    <div class="compare-icon"><i class="${item.icon}"></i></div>
                    <div class="compare-card-title">
                        <h4>${item.name}</h4>
                        <span>${item.category}</span>
                    </div>
                </div>
                <div class="compare-price">${item.details['Joining Fee'] || 'Free'}</div>
                <ul class="compare-features">
                    <li class="compare-feature"><i class="fas fa-check-circle"></i> ${item.details['Best For'] || 'General Use'}</li>
                    <li class="compare-feature"><i class="fas fa-check-circle"></i> ${item.details['Annual Fee'] || 'No annual fee'}</li>
                </ul>
            </div>
        `).join('');
    }

    // 2. Show Detailed Table (if 2+ products)
    if (selectedProducts.length < 2) {
        tableContainer.innerHTML = `
            <div style="text-align:center; padding: 40px; background: var(--bg-secondary); border-radius: 16px; margin-top: 20px; border: 1px dashed var(--border-color);">
                <i class="fas fa-info-circle" style="font-size: 32px; color: var(--primary-600); margin-bottom: 16px; opacity: 0.6;"></i>
                <h4 style="color: var(--text-primary); margin-bottom: 8px;">Add more products to compare</h4>
                <p style="color: var(--text-secondary); font-size: 14px;">Select at least one more product to see a side-by-side feature comparison table.</p>
            </div>
        `;
        return;
    }

    // Get all unique feature keys (rows)
    const allDetailKeys = new Set();
    selectedProducts.forEach(p => {
        if (p.details) {
            Object.keys(p.details).forEach(k => allDetailKeys.add(k));
        }
    });

    const rows = Array.from(allDetailKeys);

    let html = `
        <div class="compare-table-wrapper" style="overflow-x: auto;">
            <table class="compare-table">
                <thead>
                    <tr>
                        <th class="row-label">Feature Filter</th>
                        ${selectedProducts.map(p => `
                            <th class="product-col">
                                <div class="table-product-header">
                                    <i class="${p.icon}"></i>
                                    <b>${p.name}</b>
                                </div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    rows.forEach(key => {
        html += `
            <tr>
                <td class="row-label">${key}</td>
                ${selectedProducts.map(p => {
            const val = p.details ? (p.details[key] || '—') : '—';
            const valStr = String(val).toLowerCase();
            const isCheck = valStr === 'none' || val === '—' ? '<i class="fas fa-times check-no"></i>' : (valStr === 'unlimited' || valStr === 'included' ? '<i class="fas fa-check-circle check-yes"></i>' : '');
            return `<td>${isCheck ? isCheck : val}</td>`;
        }).join('')}
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    tableContainer.innerHTML = html;

    // Hide the comparison tray as requested once the table is generated
    const tray = document.getElementById('comparisonTray');
    if (tray) {
        tray.classList.remove('show');
        document.querySelector('.dashboard-container')?.classList.remove('has-tray');
    }
}

// Intercept sub-view card generation to add select buttons

function renderCompareCategoryGrid() {
    const grid = document.getElementById('compareCategoryGrid');
    if (!grid) return;

    const categories = [
        { id: 'cards', title: 'Cards', icon: 'fas fa-credit-card' },
        { id: 'loans', title: 'Loans', icon: 'fas fa-hand-holding-usd' },
        { id: 'stocks', title: 'Stock Market', icon: 'fas fa-chart-line' },
        { id: 'invest', title: 'Investment', icon: 'fas fa-chart-pie' },
        { id: 'insurance', title: 'Insurance', icon: 'fas fa-shield-alt' },
        { id: 'mortgage', title: 'Mortgages', icon: 'fas fa-house-user' },
        { id: 'crypto', title: 'Crypto', icon: 'fab fa-bitcoin' },
        { id: 'savings', title: 'Savings', icon: 'fas fa-piggy-bank' }
    ];

    grid.innerHTML = categories.map(cat => `
        <div class="action-card category-card" onclick="renderCompareProviderGrid('${cat.id}', '${cat.title}')">
            <i class="${cat.icon}"></i>
            <span>${cat.title}</span>
        </div>
    `).join('');
}

let selectedCompareProviders = [];
let currentCompareCategory = null;

function renderCompareProviderGrid(categoryKey, title) {
    const emptyState = document.getElementById('compareEmptyState');
    const multiSelectView = document.getElementById('compareProviderMultiSelectView');
    const tableContainer = document.getElementById('compareTableContainer');
    const grid = document.getElementById('providerMultiGrid');
    const subtitle = document.getElementById('compareProviderSubtitle');

    if (!emptyState || !multiSelectView || !grid) return;

    // Hide old views, show this one
    emptyState.classList.add('hidden');
    if (tableContainer) tableContainer.innerHTML = '';
    multiSelectView.classList.remove('hidden');

    currentCompareCategory = { key: categoryKey, title: title };
    selectedCompareProviders = []; // reset

    subtitle.textContent = `Select ${title} Providers`;
    grid.innerHTML = '';

    // We'll mock some providers if the static list doesn't have them
    const allProducts = productsData[categoryKey] || [];
    let providers = [...new Set(allProducts.map(p => p.provider))];

    // Add some default banks if none exist
    if (providers.length === 0) {
        if (title === 'Cards' || title === 'Loans' || title === 'Savings') {
            providers = ['SBI', 'HDFC', 'AXIS', 'ICICI', 'Kotak', 'PNB'];
        } else if (title === 'Insurance') {
            providers = ['Star Health', 'HDFC Life', 'LIC', 'Max Life', 'ICICI Lombard'];
        } else if (title === 'Stock Market' || title === 'Investment') {
            providers = ['Zerodha', 'Groww', 'Upstox', 'AngelOne', 'HDFC Sec'];
        } else {
            providers = ['Provider A', 'Provider B', 'Provider C', 'Provider D'];
        }
    }

    providers.forEach(providerName => {
        const card = document.createElement('div');
        card.className = 'action-card provider-card selectable-card';
        card.innerHTML = `
            <i class="fas fa-building" style="font-size: 24px; color: var(--primary-600); margin-bottom: 12px; display: block;"></i>
            <span style="font-weight: 600; color: var(--text-primary); transition: color 0.2s;">${providerName}</span>
            <div class="check-indicator" style="position: absolute; top: 8px; right: 8px; display: flex; color: white; background: var(--primary-600); border-radius: 50%; width: 32px; height: 32px; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid white; z-index: 5; opacity: 0; transition: opacity 0.2s; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);">
                0
            </div>
            <div class="remove-instance-btn" style="position: absolute; top: 8px; left: 8px; display: none; color: white; background: #ef4444; border-radius: 50%; width: 32px; height: 32px; align-items: center; justify-content: center; font-size: 18px; line-height: 1; cursor: pointer; transition: all 0.2s; z-index: 6; border: 3px solid white; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);">
                ×
            </div>
        `;

        card.addEventListener('click', (e) => {
            // If they clicked the minus button specifically
            if (e.target.closest('.remove-instance-btn')) {
                const idx = selectedCompareProviders.lastIndexOf(providerName);
                if (idx !== -1) {
                    selectedCompareProviders.splice(idx, 1);
                }
                renderCompareProviderGridUpdateCounts();
                updateContinueBtn();
                return;
            }

            const count = selectedCompareProviders.filter(p => p === providerName).length;
            const totalCount = selectedCompareProviders.length;

            if (totalCount >= 4 && count === 0) {
                showFinanceActionModal({
                    title: 'Limit Reached',
                    message: 'You can compare a maximum of 4 items at once. Remove one to add another.',
                    confirmText: 'OK',
                    cancelText: 'Cancel',
                    destructive: true,
                    hideCancel: true
                });
                return;
            }

            selectedCompareProviders.push(providerName);
            if (selectedCompareProviders.length > 4) {
                selectedCompareProviders.shift();
            }

            renderCompareProviderGridUpdateCounts();
            updateContinueBtn();
        });

        grid.appendChild(card);
    });

    // Ensure continue button listener is correctly bound
    const btn = document.getElementById('continueToCompareBtn');
    if (btn) {
        // Remove all previous listeners to prevent duplicate event handlers
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        const refreshedBtn = document.getElementById('continueToCompareBtn');
        refreshedBtn.addEventListener('click', () => {
            console.log("Continue clicked, providers:", selectedCompareProviders);
            if (selectedCompareProviders.length > 0) {
                renderCompareMatrixView();
            }
        });
    }

    updateContinueBtn();
    updateCardStylesInitial();
}

function renderCompareProviderGridUpdateCounts() {
    document.querySelectorAll('.provider-card').forEach(card => {
        const name = card.querySelector('span').textContent.split(' (')[0];
        const count = selectedCompareProviders.filter(p => p === name).length;
        const check = card.querySelector('.check-indicator');
        const removeBtn = card.querySelector('.remove-instance-btn');
        const span = card.querySelector('span');

        if (count > 0) {
            card.style.borderColor = 'var(--primary-600)';
            card.style.background = 'rgba(102, 126, 234, 0.15)';
            span.style.color = 'var(--primary-600)';
            span.textContent = count > 1 ? `${name} (${count})` : name;
            check.textContent = count;
            check.style.opacity = '1';
            if (removeBtn) removeBtn.style.display = 'flex';
        } else {
            card.style.borderColor = 'var(--border-color)';
            card.style.background = 'var(--card-bg)';
            span.style.color = 'var(--text-primary)';
            span.textContent = name;
            check.style.opacity = '0';
            if (removeBtn) removeBtn.style.display = 'none';
        }
    });
}

function updateContinueBtn() {
    const btn = document.getElementById('continueToCompareBtn');
    if (btn) {
        const isValid = selectedCompareProviders.length > 0;
        btn.disabled = !isValid;
        btn.style.opacity = isValid ? '1' : '0.4';
        btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        btn.style.filter = isValid ? 'none' : 'grayscale(1)';
        btn.style.pointerEvents = 'auto'; // Ensure it captures clicks even when "disabled" to show feedback if needed
        btn.style.transform = isValid ? 'scale(1)' : 'scale(0.95)';
    }
}

function updateCardStylesInitial() {
    // Just a helper to set initial state if needed
    renderCompareProviderGridUpdateCounts();
}

// Override clearSelection to handle new views
const oldClearSelection = window.clearSelection;
window.clearSelection = function () {
    if (oldClearSelection) oldClearSelection();

    // Reset our new views
    selectedCompareProviders = [];
    currentCompareCategory = null;

    const multiSelectView = document.getElementById('compareProviderMultiSelectView');
    const tableContainer = document.getElementById('compareTableContainer');
    const emptyState = document.getElementById('compareEmptyState');

    if (multiSelectView) multiSelectView.classList.add('hidden');
    if (tableContainer) tableContainer.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
};

function renderCompareMatrixView() {
    const multiSelectView = document.getElementById('compareProviderMultiSelectView');
    const tableContainer = document.getElementById('compareTableContainer');
    if (!multiSelectView || !tableContainer) return;

    multiSelectView.classList.add('hidden');

    // We need standard product lists for the dropdowns
    // If not found in productsData, we mock a few
    const category = currentCompareCategory.key;
    const allProducts = productsData[category] || [];

    const getProductsForProvider = (provider) => {
        let matching = allProducts.filter(p => p.provider === provider);
        if (matching.length === 0) {
            return [
                { id: `${provider}_basic`, name: `${provider} Standard` },
                { id: `${provider}_premium`, name: `${provider} Premium` },
                { id: `${provider}_elite`, name: `${provider} Elite` }
            ];
        }
        return matching;
    };

    const categoryTitle = currentCompareCategory.title;
    const categoryKeyMaps = {
        'Cards': ["Joining Fee", "Annual Fee", "Reward Rate", "Lounge Access", "Forex Markup", "Milestones/Offers", "Best For"],
        'Loans': ["Interest Rate", "Processing Fee", "Max Loan Amount", "Tenure", "Eligibility", "Foreclosure Charges"],
        'Stock Market': ["Brokerage (Intraday)", "Brokerage (Delivery)", "Account Opening Fee", "AMC", "Platforms", "Margin/Leverage"],
        'Stocks': ["Brokerage (Intraday)", "Brokerage (Delivery)", "Account Opening Fee", "AMC", "Platforms", "Margin/Leverage"]
    };
    const masterKeys = categoryKeyMaps[categoryTitle] || [];

    let html = `
        <div class="compare-header" style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <button class="btn-outline back-btn" onclick="renderCompareProviderGrid('${currentCompareCategory.key}', '${currentCompareCategory.title}')" style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-secondary); cursor: pointer;">
                <i class="fas fa-arrow-left"></i> Change Banks
            </button>
            <div style="flex: 1; text-align: center;">
                <h3 style="margin: 0; font-family: 'Poppins'; font-weight: 700; color: var(--primary-600);">${currentCompareCategory.title} Comparison</h3>
                <p style="color: var(--text-secondary); font-size: 13px; margin: 4px 0 0 0;">Compare up to ${selectedCompareProviders.length} providers side-by-side.</p>
            </div>
            <div style="width: 140px;"></div> <!-- Spacer to keep title centered -->
        </div>
        
        <div class="compare-matrix-wrapper" style="overflow-x: auto; padding-bottom: 20px;">
            <div class="compare-matrix-grid" style="display: grid; grid-template-columns: 180px repeat(${selectedCompareProviders.length}, minmax(200px, 1fr)); gap: 0; border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden; background: var(--card-bg); box-shadow: var(--shadow-lg);">
                
                <!-- Label Column -->
                <div class="compare-labels-col" style="background: var(--bg-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column;">
                    <div style="height: 140px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; padding: 16px; background: var(--bg-tertiary);">
                        <span style="font-weight: 700; color: var(--text-tertiary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Features</span>
                    </div>
                    ${masterKeys.map(key => `
                        <div class="label-row" style="height: 100px; padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center;">
                            <span style="font-weight: 600; font-size: 12px; color: var(--text-secondary); line-height: 1.3;">${key}</span>
                        </div>
                    `).join('')}
                    <div style="flex: 1; background: var(--bg-tertiary);"></div>
                </div>
    `;

    selectedCompareProviders.forEach((provider, idx) => {
        const prodList = getProductsForProvider(provider);
        html += `
            <div class="compare-column" id="compare-col-${idx}" style="display: flex; flex-direction: column; position: relative; border-right: ${idx === selectedCompareProviders.length - 1 ? 'none' : '1px solid var(--border-color)'};">
                <!-- Remove Column Button -->
                <button onclick="removeCompareColumn(${idx})" style="position: absolute; top: 12px; right: 12px; border: none; background: rgba(239, 68, 68, 0.1); color: #ef4444; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; z-index: 10; transition: all 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='white'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.color='#ef4444'">
                    <i class="fas fa-times"></i>
                </button>
                
                <div class="compare-col-header" style="height: 140px; padding: 16px 12px; border-bottom: 1px solid var(--border-color); text-align: center; background: var(--card-bg); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px;">
                    <div style="width: 36px; height: 36px; background: var(--primary-100); color: var(--primary-600); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-building" style="font-size: 18px;"></i>
                    </div>
                    <h4 style="margin: 0; font-size: 14px; font-weight: 700;">${provider}</h4>
                    <select class="product-dropdown" onchange="fetchProductDetails(this.value, '${provider}', ${idx})" style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); font-family: 'Poppins'; font-size: 11px; cursor: pointer; outline: none; transition: all 0.2s;">
                        <option value="" disabled selected>Select...</option>
                        ${prodList.map(p => `<option value="${p.id || p.name}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="compare-col-body" id="compare-body-${idx}" style="display: flex; flex-direction: column;">
                    ${masterKeys.map(() => `
                        <div class="feature-row placeholder" style="height: 100px; padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.01);">
                            <div style="width: 40%; height: 8px; background: var(--border-color); border-radius: 4px; opacity: 0.3;"></div>
                        </div>
                    `).join('')}
                    <div style="flex: 1; padding: 30px 16px; text-align: center; color: var(--text-tertiary); font-size: 12px; font-style: italic;">
                        Select a product
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;
    tableContainer.innerHTML = html;
}

window.removeCompareColumn = function (idx) {
    if (selectedCompareProviders.length > 0) {
        selectedCompareProviders.splice(idx, 1);
        if (selectedCompareProviders.length === 0) {
            clearSelection();
        } else {
            renderCompareMatrixView();
        }
    }
};

async function fetchProductDetails(productId, providerName, colIndex) {
    const colBody = document.getElementById(`compare-body-${colIndex}`);
    if (!colBody) return;

    // Fallback names if ID is used
    let productName = productId;
    const catProds = productsData[currentCompareCategory.key] || [];
    const found = catProds.find(p => p.id === productId);
    if (found) productName = found.name;

    colBody.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--primary-600);">
            <i class="fas fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 16px;"></i>
            <p style="font-size: 14px; color: var(--text-secondary); font-weight: 500;">Analyzing financial documents...</p>
        </div>
    `;

    try {
        const payload = {
            product_name: productName,
            provider: providerName,
            category: currentCompareCategory.title
        };

        console.log("[COMPARE] Fetching details for:", productName, "from provider:", providerName);
        const response = await fetch('/api/compare_product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("[COMPARE] API Error:", response.status);
            throw new Error("API failed");
        }

        const data = await response.json();
        console.log("[COMPARE] Data received:", data);
        const features = data.features || {};

        const categoryTitle = currentCompareCategory.title;
        const categoryKeyMaps = {
            'Cards': ["Joining Fee", "Annual Fee", "Reward Rate", "Lounge Access", "Forex Markup", "Milestones/Offers", "Best For"],
            'Loans': ["Interest Rate", "Processing Fee", "Max Loan Amount", "Tenure", "Eligibility", "Foreclosure Charges"],
            'Stock Market': ["Brokerage (Intraday)", "Brokerage (Delivery)", "Account Opening Fee", "AMC", "Platforms", "Margin/Leverage"],
            'Stocks': ["Brokerage (Intraday)", "Brokerage (Delivery)", "Account Opening Fee", "AMC", "Platforms", "Margin/Leverage"]
        };

        const masterKeys = categoryKeyMaps[categoryTitle] || Object.keys(features);

        let contentHtml = '';
        if (Object.keys(features).length === 0) {
            contentHtml = `
                <div style="height: 100%; padding: 30px 16px; text-align: center; background: rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 20px; color: #f59e0b; opacity: 0.7;"></i>
                    <p style="font-size: 12px; color: var(--text-tertiary); margin: 0;">No data found</p>
                </div>
            `;
        } else {
            contentHtml = masterKeys.map(key => {
                const val = features[key] || "Not Available";
                return `
                    <div class="feature-row" style="height: 100px; padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; line-height: 1.4; font-size: 12px; font-weight: 500; color: var(--text-primary); text-align: center; word-break: break-word;">
                        ${val}
                    </div>
                `;
            }).join('');

            // Fill remaining space
            contentHtml += `<div style="flex: 1; background: var(--bg-tertiary); min-height: 100px;"></div>`;
        }

        colBody.innerHTML = contentHtml;

    } catch (err) {
        console.error(err);
        colBody.innerHTML = `
            <div style="text-align: center; padding: 30px 20px; color: var(--text-secondary); border: 1px solid #fecaca; border-radius: 12px; background: #fef2f2;">
                <i class="fas fa-times-circle" style="font-size: 24px; margin-bottom: 12px; color: #ef4444;"></i>
                <p style="font-size: 14px; color: #b91c1c;">Failed to extract data. Please try again later.</p>
            </div>
        `;
    }
}

async function populateWhatChangedView() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-tertiary);"><i class="fas fa-spinner fa-spin"></i> Loading latest updates...</p>';

    try {
        const res = await fetch('/api/what_changed');
        const data = await res.json();

        if (data.status === 'success' && data.updates && data.updates.length > 0) {
            container.innerHTML = data.updates.map(item => `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <span class="timeline-date">${item.date}</span>
                    <div class="timeline-content">
                        <div class="timeline-title">
                            ${item.title}
                            <span class="timeline-badge ${item.badgeClass}">${item.badge}</span>
                        </div>
                        <div class="timeline-diff">
                            <span class="diff-old">${item.oldVal}</span>
                            <i class="fas fa-arrow-right diff-arrow"></i>
                            <span class="diff-new">${item.newVal}</span>
                        </div>
                        <p style="margin-top:12px; font-size:14px; color:var(--text-secondary);">${item.desc}</p>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-tertiary);">No new updates found.</p>';
        }
    } catch (err) {
        console.error("Error fetching what_changed:", err);
        container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-danger);">Failed to load updates. Please try again.</p>';
    }
}
function setupChatPanel() {
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatWindow = document.getElementById('chatWindow');
    const chatCloseBtn = document.getElementById('chatCloseBtn');

    if (chatToggleBtn && chatWindow) {
        chatToggleBtn.addEventListener('click', () => {
            const isOpen = chatWindow.classList.contains('open');
            if (isOpen) {
                chatWindow.classList.remove('open');
                chatToggleBtn.classList.remove('active');
            } else {
                chatWindow.classList.add('open');
                chatToggleBtn.classList.add('active');
            }
        });
    }

    if (chatCloseBtn && chatWindow) {
        chatCloseBtn.addEventListener('click', () => {
            chatWindow.classList.remove('open');
            if (chatToggleBtn) chatToggleBtn.classList.remove('active');
        });
    }

    // New Chat Button
    const newChatSidebarBtn = document.getElementById('newChatSidebarBtn');
    if (newChatSidebarBtn) {
        newChatSidebarBtn.addEventListener('click', startNewChat);
    }

    // Quick Prompts
    const promptBtns = document.querySelectorAll('.prompt-btn');
    promptBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.value = this.textContent.trim();
                const sendBtn = document.getElementById('sendBtn');
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.click();
                }
            }
        });
    });
}
function setupActionCards() {
    console.log("Finclarity AI: Setting up Category and Sub-category cards...");

    // Level 1: Home Category Cards
    const cards = document.querySelectorAll('.category-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const target = card.getAttribute('data-target');
            const title = card.getAttribute('data-title');
            console.log(`DEBUG: Home Card Clicked - Target: ${target}, Title: ${title}`);
            if (target) {
                navigateTo(target, title);
            } else if (card.id === 'homeCalculatorsCard') {
                renderCalculatorsHub();
            } else if (card.id === 'homeTodoCard') {
                openFinanceView('todoView', 'Financial To-Do List');
            } else if (card.id === 'homeSuggestionsCard') {
                openFinanceView('suggestionsView', 'Smart Suggestions');
            }
        });
    });

    // Level 2: Sub-category cards (Debit Cards, Credit Cards, etc. in sub-views)
    const subCards = document.querySelectorAll('.sub-view-grid .action-card');
    console.log(`DEBUG: Found ${subCards.length} sub-view cards to bind.`);

    subCards.forEach(card => {
        // Skip provider cards as they are handled dynamically
        if (card.classList.contains('provider-card')) return;

        card.addEventListener('click', () => {
            const span = card.querySelector('span');
            if (span) {
                const subCategoryName = span.textContent;
                console.log(`DEBUG: Sub-Card Clicked - Category: ${subCategoryName}`);
                openProviderSelection(subCategoryName);
            }
        });
    });
}

function switchToSubView(viewId, title) {
    // Add to nav stack
    navStack.push({ id: viewId, title: title });
    renderBreadcrumb();

    document.querySelectorAll('.main-content > div').forEach(v => {
        if (v.id === viewId || v.classList.contains('dashboard-header-simple')) {
            v.classList.remove('hidden');
        } else {
            v.classList.add('hidden');
        }
    });
}
function setupResponsive() { }


// ============================================
// SETTINGS DROPDOWN & LOGOUT LOGIC
// ============================================

function setupSettingsAndLogout() {
    console.log("Setting up settings and logout listeners");
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsDropdown');

    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
                settingsMenu.classList.remove('show');
            }
        });
    } else {
        console.warn("Settings elements not found!");
    }

    const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        // Theme logic is now handled by theme-toggle.js
    }

    if (dropdownLogoutBtn && logoutModal) {
        dropdownLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Logout triggered");
            if (settingsMenu) settingsMenu.classList.remove('show');
            logoutModal.classList.add('show');
        });
    }

    if (cancelLogoutBtn && logoutModal) {
        cancelLogoutBtn.addEventListener('click', () => {
            logoutModal.classList.remove('show');
        });
    }

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', async () => {
            console.log("Logout confirmed by user");
            try {
                // Supabase Logout (if active)
                if (window.supabase) {
                    await window.supabase.auth.signOut();
                }
                // Backend Logout
                await fetch('/api/logout', { method: 'POST' });
            } catch (e) {
                console.error("Logout process error", e);
            }

            // Final cleanup and redirect
            const user = window.currentUserData;
            if (user && user.email) {
                localStorage.removeItem(`finclarityChats_${user.email}`);
                localStorage.removeItem(`finclarityMemory_${user.email}`);
            }
            localStorage.removeItem('finclarityChats');
            localStorage.removeItem('finclarityMemory');
            localStorage.removeItem('currentUser');

            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) {
                    localStorage.removeItem(key);
                }
            });
            sessionStorage.clear();
            window.location.href = "/login";
        });
    }
}

// ============================================
// PROFILE MODAL LOGIC (SaaS STYLE)
// ============================================

function setupProfileModal() {
    const profileBtn = document.getElementById('profileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const body = document.body;

    if (!profileModal) return;

    // Open Modal
    if (profileBtn) {
        profileBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            // Populate data
            const user = window.currentUserData || {};
            const name = user.name || "User";
            const email = user.email || "";

            document.getElementById('displayUsername').textContent = name;
            document.getElementById('displayEmail').textContent = email;

            document.getElementById('editUsername').value = name;
            document.getElementById('editEmail').value = email;

            // Clear passwords
            const pwFields = [document.getElementById('currentPassword'), document.getElementById('newPassword')];
            pwFields.forEach(f => { if (f) f.value = ''; });

            // Check if user has a password (email provider)
            if (window.supabase) {
                const { data: { user: sbUser } } = await window.supabase.auth.getUser();
                if (sbUser) {
                    const hasPassword = sbUser.identities && sbUser.identities.some(id => id.provider === 'email');

                    const currentPwGroup = document.getElementById('currentPasswordGroup');
                    const currentPwInput = document.getElementById('currentPassword');
                    const changePwBtn = document.getElementById('changePasswordBtn');

                    if (hasPassword) {
                        if (currentPwGroup) currentPwGroup.style.display = 'block';
                        if (currentPwInput) currentPwInput.setAttribute('required', '');
                        if (changePwBtn) changePwBtn.textContent = 'Change Password';
                    } else {
                        if (currentPwGroup) currentPwGroup.style.display = 'none';
                        if (currentPwInput) currentPwInput.removeAttribute('required');
                        if (changePwBtn) changePwBtn.textContent = 'Set Password';
                    }
                }
            }

            // Set Avatar Initials
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('profileAvatar').textContent = initials || "?";

            // Hide Settings Dropdown
            const settingsMenu = document.getElementById('settingsMenu');
            if (settingsMenu) settingsMenu.classList.remove('show');

            profileModal.classList.add('show');
            body.style.overflow = 'hidden'; // Prevent scrolling
        });
    }

    // Close Modal
    const closeModal = () => {
        profileModal.classList.remove('show');
        body.style.overflow = '';
    };

    if (closeProfileBtn) {
        closeProfileBtn.addEventListener('click', closeModal);
    }

    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && profileModal.classList.contains('show')) closeModal();
    });

    // Handle Update Profile Form
    const updateProfileForm = document.getElementById('updateProfileForm');
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveProfileBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Saving...';
            btn.disabled = true;

            const name = document.getElementById('editUsername').value;
            const email = document.getElementById('editEmail').value;

            try {
                const res = await fetch('/update_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, email })
                });

                const data = await res.json();
                if (data.status === 'success') {
                    // Update local details
                    if (window.currentUserData) {
                        window.currentUserData.name = name;
                        window.currentUserData.email = email;
                    }

                    document.getElementById('displayUsername').textContent = name;
                    document.getElementById('displayEmail').textContent = email;

                    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    document.getElementById('profileAvatar').textContent = initials;

                    // Update main screen username displays
                    const headerNames = document.querySelectorAll('.dashboard-header-simple h2, .profile-name');
                    headerNames.forEach(el => { el.textContent = name; });

                    btn.textContent = 'Saved!';
                    btn.style.background = '#4caf50';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 2000);
                } else {
                    alert(data.message || 'Error updating profile');
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                alert('Connection error');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Handle Change Password Form
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('changePasswordBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Updating...';
            btn.disabled = true;

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;

            if (newPassword.length < 6) {
                alert("Password must be at least 6 characters long.");
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            try {
                // 🔥 Use Supabase client directly for better multi-auth support
                if (!window.supabase) throw new Error("Supabase not initialized");

                // Ensure we have a session
                const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
                if (sessionError || !session) {
                    throw new Error("Your session has expired or is missing. Please try logging out and back in once to refresh your connection.");
                }

                const { data, error } = await window.supabase.auth.updateUser({
                    password: newPassword
                });

                if (error) {
                    throw error;
                }

                btn.textContent = 'Success!';
                btn.style.borderColor = '#4caf50';
                btn.style.color = '#4caf50';
                changePasswordForm.reset();

                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.borderColor = '';
                    btn.style.color = '';
                    btn.disabled = false;
                }, 2500);
            } catch (err) {
                console.error("Password update error:", err);
                alert(err.message || 'Error updating password');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Modal Logout Button matches standard logout
    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', async () => {
            profileLogoutBtn.textContent = 'Logging out...';
            profileLogoutBtn.disabled = true;
            try {
                if (window.supabase) await window.supabase.auth.signOut();
                await fetch('/api/logout', { method: 'POST' });

                // Clear ALL user related data
                const user = window.currentUserData;
                if (user && user.email) {
                    localStorage.removeItem(`finclarityChats_${user.email}`);
                    localStorage.removeItem(`finclarityMemory_${user.email}`);
                }
                localStorage.removeItem('finclarityChats');
                localStorage.removeItem('finclarityMemory');
                localStorage.removeItem('currentUser');

                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-')) {
                        localStorage.removeItem(key);
                    }
                });
                sessionStorage.clear();
                window.location.href = "/login";
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = "/";
            }
        });
    }
}

// ============================================
// STACK-BASED DEEP NAVIGATION LOGIC
// ============================================

let navStack = [];

const providersData = {
    'default': [
        { name: 'HDFC', icon: 'fas fa-building' }, { name: 'SBI', icon: 'fas fa-building' }, { name: 'AXIS', icon: 'fas fa-building' }, { name: 'UBI', icon: 'fas fa-building' },
        { name: 'PNB', icon: 'fas fa-building' }, { name: 'BOB', icon: 'fas fa-building' }, { name: 'YES BANK', icon: 'fas fa-building' }, { name: 'CENTRAL BANK', icon: 'fas fa-building' },
        { name: 'CANARA', icon: 'fas fa-building' }, { name: 'IDFC', icon: 'fas fa-building' }
    ],
    'Stock Market': [
        { name: 'Zerodha', icon: 'fas fa-chart-line' }, { name: 'Groww', icon: 'fas fa-chart-line' }, { name: 'Upstox', icon: 'fas fa-chart-line' },
        { name: 'Angel One', icon: 'fas fa-chart-line' }, { name: 'ICICI Direct', icon: 'fas fa-chart-line' }, { name: 'HDFC Sec', icon: 'fas fa-chart-line' }
    ],
    'Crypto': [
        { name: 'CoinDCX', icon: 'fab fa-bitcoin' }, { name: 'WazirX', icon: 'fab fa-bitcoin' }, { name: 'ZebPay', icon: 'fab fa-bitcoin' },
        { name: 'Binance', icon: 'fab fa-bitcoin' }, { name: 'CoinSwitch', icon: 'fab fa-bitcoin' }, { name: 'Coinbase', icon: 'fab fa-bitcoin' }
    ],
    'Investment': [
        { name: 'Zerodha Coin', icon: 'fas fa-leaf' }, { name: 'Groww', icon: 'fas fa-leaf' }, { name: 'ET Money', icon: 'fas fa-leaf' },
        { name: 'Kuvera', icon: 'fas fa-leaf' }, { name: 'SBI Mutual Fund', icon: 'fas fa-leaf' }, { name: 'HDFC AMC', icon: 'fas fa-leaf' }
    ],
    'Insurance': [
        { name: 'LIC India', icon: 'fas fa-shield-alt' }, { name: 'HDFC Life', icon: 'fas fa-shield-alt' }, { name: 'SBI Life', icon: 'fas fa-shield-alt' },
        { name: 'ICICI Lombard', icon: 'fas fa-shield-alt' }, { name: 'Star Health', icon: 'fas fa-shield-alt' }, { name: 'Bajaj Allianz', icon: 'fas fa-shield-alt' }
    ]
};

const subCategoryProducts = {
    "Credit Cards": {
        "HDFC": ["Regalia Gold", "Millennia", "Infinia", "MoneyBack+"],
        "SBI": ["SBI Card ELITE", "SBI Card PRIME", "SimplyClick", "SimplySave"],
        "ICICI": ["Amazon Pay ICICI", "Coral", "Rubyx", "Sapphiro"],
        "AXIS": ["Magnus", "Atlas", "Ace", "Flipkart Axis"]
    },
    "Personal Loans": {
        "HDFC": ["Quick Personal Loan", "Loan on Credit Card"],
        "SBI": ["Xpress Credit", "Pension Loan"],
        "ICICI": ["Instant Personal Loan"]
    },
    "Savings Accounts": {
        "HDFC": ["Regular Savings", "Women's Savings", "Senior Citizen Account"],
        "SBI": ["Basic Savings Bank Deposit", "Savings Plus Account"]
    }
};

function setupAdvancedNavigation() {
    // This is now largely handled by setupActionCards and initializeDashboard
    // But we keep it to initialize the Hero Page logic
    setupHomePageSexyLogic();
}

function setupHomePageSexyLogic() {
    // 1. Dynamic Greeting
    const greetingEl = document.getElementById('dynamicGreeting');
    if (greetingEl) {
        const hour = new Date().getHours();
        let greeting = "Good Evening";
        if (hour < 12) greeting = "Good Morning";
        else if (hour < 17) greeting = "Good Afternoon";

        const username = window.currentUserData?.name?.split(' ')[0] || "Trader";
        greetingEl.textContent = `${greeting}, ${username}`;
    }

    // 2. Staggered Animations
    const cards = document.querySelectorAll('#mainView .action-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';

        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 + (index * 60));
    });

    // 3. Hero Stats entry
    const stats = document.querySelectorAll('.hero-stat-card');
    stats.forEach((stat, index) => {
        stat.style.opacity = '0';
        stat.style.transform = 'scale(0.9)';
        stat.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        setTimeout(() => {
            stat.style.opacity = '1';
            stat.style.transform = 'scale(1)';
        }, 400 + (index * 100));
    });
}

function navigateTo(viewId, title) {
    const currentViewId = navStack.length > 0 ? navStack[navStack.length - 1].id : null;

    // Push new state onto stack
    navStack.push({ id: viewId, title: title });

    renderBreadcrumb();

    // Animate out current and animate in new
    if (currentViewId && currentViewId !== viewId) {
        hideView(currentViewId, () => showTargetView(viewId));
    } else {
        showTargetView(viewId);
    }
}

function navigateBackTo(index) {
    if (index >= navStack.length - 1) return;

    const currentViewId = navStack[navStack.length - 1].id;
    const targetViewId = navStack[index].id;

    // Pop stack
    navStack = navStack.slice(0, index + 1);

    renderBreadcrumb();

    if (currentViewId !== targetViewId) {
        hideView(currentViewId, () => showTargetView(targetViewId));
    }
}

function hideView(viewId, callback) {
    const view = document.getElementById(viewId);
    if (!view) {
        if (callback) callback();
        return;
    }

    view.style.opacity = 0;
    view.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        view.classList.add('hidden');
        if (callback) callback();
    }, 250);
}

function showTargetView(viewId) {
    const targetView = document.getElementById(viewId);
    if (!targetView) return;

    targetView.classList.remove('hidden');
    targetView.style.opacity = 0;
    targetView.style.transform = 'translateY(10px)';

    void targetView.offsetWidth; // Force Reflow

    targetView.style.opacity = 1;
    targetView.style.transform = 'translateY(0)';
}

function renderBreadcrumb() {
    const dashboardHeaderTitle = document.getElementById('dashboardHeaderTitle');
    if (!dashboardHeaderTitle) return;

    const headerContainer = dashboardHeaderTitle.closest('.dashboard-header-simple');
    if (headerContainer) {
        headerContainer.style.display = navStack.length > 1 ? 'flex' : 'none';
    }

    if (navStack.length <= 1) {
        const user = window.currentUserData;
        dashboardHeaderTitle.textContent = user && user.name ? user.name : "Home";
        return;
    }

    let html = '';
    for (let i = 0; i < navStack.length; i++) {
        const item = navStack[i];
        if (i === navStack.length - 1) {
            html += `<span style="color:var(--text-primary); font-weight:600;">${item.title}</span>`;
        } else {
            const separator = i === 0 ? '<i class="fas fa-arrow-left" style="margin-right:4px;"></i>' : '';
            html += `<a href="#" class="nav-crumb" data-index="${i}" style="color:var(--text-secondary); text-decoration:none; transition: color 0.2s;">${separator}${item.title}</a> <span style="margin: 0 10px; color:var(--text-tertiary);"><i class="fas fa-angle-right" style="font-size:12px;"></i></span> `;
        }
    }

    dashboardHeaderTitle.innerHTML = html;

    // Bind click events on the newly generated crumb links
    document.querySelectorAll('.nav-crumb').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(el.getAttribute('data-index'));
            navigateBackTo(targetIndex);
        });
    });
}

function openProviderSelection(featureTitle) {
    const providerGrid = document.getElementById('providerGrid');
    const subtitle = document.getElementById('providerSelectionSubtitle');
    if (!providerGrid || !subtitle) return;

    let mainCategory = 'default';
    if (navStack.length >= 2) {
        mainCategory = navStack[1].title;
    }

    const listToUse = providersData[mainCategory] || providersData['default'];

    let providerTypeTerm = "Provider";
    if (mainCategory === 'Stock Market') providerTypeTerm = "Broker";
    subtitle.textContent = `Select a ${providerTypeTerm} for ${featureTitle}`;

    providerGrid.innerHTML = '';

    listToUse.forEach((provider, index) => {
        const card = document.createElement('div');
        card.className = 'action-card provider-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.innerHTML = `<i class="${provider.icon}"></i><span>${provider.name}</span>`;

        card.addEventListener('click', () => {
            openProductSelection(provider.name, featureTitle);
        });

        providerGrid.appendChild(card);

        // Staggered Animation
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });

    navigateTo('providerSelectionView', featureTitle);
}

function openProductSelection(providerName, subCategory) {
    const productGrid = document.getElementById('productGrid');
    const subtitle = document.getElementById('productSelectionSubtitle');
    if (!productGrid || !subtitle) return;

    subtitle.textContent = `Select ${subCategory} from ${providerName}`;
    productGrid.innerHTML = '';

    // Get specific products or fallback to generic ones
    const products = (subCategoryProducts[subCategory] && subCategoryProducts[subCategory][providerName])
        || [`Standard ${subCategory}`, `Premium ${subCategory}`, `Elite ${subCategory}`];

    products.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'action-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        let icon = 'fas fa-star';
        if (subCategory.includes('Card')) icon = 'fas fa-credit-card';
        if (subCategory.includes('Loan')) icon = 'fas fa-hand-holding-usd';

        card.innerHTML = `<i class="${icon}"></i><span>${product}</span>`;

        card.addEventListener('click', () => {
            openProductDetails(product, providerName, subCategory);
        });

        productGrid.appendChild(card);

        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });

    navigateTo('productSelectionView', providerName);
}

let activeProductDetails = null;

async function openProductDetails(productName, provider, category) {
    navigateTo('productDetailView', productName);

    const detailContent = document.getElementById('detailContent');
    const titleEl = document.getElementById('productDetailTitle');

    titleEl.textContent = productName;
    detailContent.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 20px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: var(--primary-500);"></i>
            <p style="color: var(--text-secondary); font-size: 16px;">Finclarity AI is extracting exhaustive details for <b>${productName}</b>...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/product_details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_name: productName, provider, category })
        });

        const data = await response.json();
        if (data.status === 'success') {
            activeProductDetails = data.details;
            renderProductDetails('overview');
        } else {
            throw new Error(data.message);
        }
    } catch (err) {
        detailContent.innerHTML = `<div class="error-state">Failed to load details: ${err.message}</div>`;
    }
}

function switchDetailTab(tabName) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.detail-tab[data-tab="${tabName}"]`).classList.add('active');
    renderProductDetails(tabName);
}

function renderProductDetails(tab) {
    const detailContent = document.getElementById('detailContent');
    if (!activeProductDetails) return;

    const d = activeProductDetails;
    let html = '';

    if (tab === 'overview') {
        html = `
            <div class="info-grid">
                <div class="info-item">
                    <h4><i class="fas fa-bullseye"></i> Best For</h4>
                    <div class="value">${d.overview.best_for}</div>
                </div>
                <div class="info-item">
                    <h4><i class="fas fa-info-circle"></i> Summary</h4>
                    <div class="value" style="font-size: 15px; font-weight: 500; line-height: 1.6;">${d.overview.summary}</div>
                </div>
            </div>
            <div style="margin-top: 30px;">
                <h4 style="color: var(--primary-400); margin-bottom: 15px;">Key Highlights</h4>
                ${d.overview.highlights.map(h => `<div class="list-item"><i class="fas fa-check-circle"></i><span>${h}</span></div>`).join('')}
            </div>
        `;
    } else if (tab === 'benefits') {
        html = `
            <h3 style="margin-bottom: 20px; font-size: 20px;">Comprehensive Benefits</h3>
            <div class="info-grid">
                ${d.benefits.map(b => `<div class="info-item" style="padding: 15px;"><div class="list-item" style="margin:0;"><i class="fas fa-gift"></i><span style="color:var(--text-primary); font-weight:500;">${b}</span></div></div>`).join('')}
            </div>
        `;
    } else if (tab === 'fees') {
        html = `
            <div class="info-grid">
                <div class="info-item"><h4>Joining Fee</h4><div class="value">${d.fees.joining}</div></div>
                <div class="info-item"><h4>Annual Fee</h4><div class="value">${d.fees.annual}</div></div>
                <div class="info-item"><h4>Interest Rate</h4><div class="value">${d.fees.interest}</div></div>
                <div class="info-item"><h4>Forex Markup</h4><div class="value">${d.fees.forex}</div></div>
            </div>
            <div style="margin-top: 30px;">
                <h4 style="color: var(--primary-400); margin-bottom: 15px;">Other Charges</h4>
                ${d.fees.others.map(o => `<div class="list-item"><i class="fas fa-minus-circle"></i><span>${o}</span></div>`).join('')}
            </div>
        `;
    } else if (tab === 'eligibility') {
        html = `
            <div class="info-grid">
                <div class="info-item"><h4>Age Criteria</h4><div class="value">${d.eligibility.age}</div></div>
                <div class="info-item"><h4>Income Range</h4><div class="value">${d.eligibility.income}</div></div>
            </div>
            <div style="margin-top: 30px;">
                <h4 style="color: var(--primary-400); margin-bottom: 15px;">Required Documents</h4>
                <div class="info-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                    ${d.eligibility.docs.map(doc => `<div class="info-item"><span>${doc}</span></div>`).join('')}
                </div>
            </div>
        `;
    } else if (tab === 'verdict') {
        html = `
            <div class="verdict-card" style="margin-top:0;">
                <div class="verdict-badge">EXPERT REVIEW</div>
                <h2 style="margin-bottom: 15px; font-size: 24px;">AI Analysis Verdict</h2>
                <p style="font-size: 16px; line-height: 1.8; margin-bottom: 25px;">${d.verdict.recommendation}</p>
                
                <div class="info-grid">
                    <div>
                        <h4 style="color: var(--success);"><i class="fas fa-plus"></i> Pros</h4>
                        ${d.verdict.pros.map(p => `<div class="list-item"><i class="fas fa-check" style="color:var(--success);"></i><span>${p}</span></div>`).join('')}
                    </div>
                    <div>
                        <h4 style="color: var(--danger);"><i class="fas fa-minus"></i> Cons</h4>
                        ${d.verdict.cons.map(c => `<div class="list-item"><i class="fas fa-times" style="color:var(--danger);"></i><span>${c}</span></div>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    detailContent.innerHTML = html;
}

console.log('Finclarity AI Dashboard main logic initialized');

// ============================================
// FINANCIAL CALCULATORS SUITE (ULTRA PREMIUM V2)
// ============================================

function injectPremiumCalculatorStyles() {
    if (document.getElementById('premium-calc-styles')) return;

    const style = document.createElement('style');
    style.id = 'premium-calc-styles';
    style.innerHTML = `
        .calculator-container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }

        .calculator-layout {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 30px;
            margin-top: 20px;
        }

        .calc-inputs {
            background: var(--bg-secondary);
            padding: 40px;
            border-radius: 30px;
            border: 1px solid var(--border-color);
            box-shadow: 0 20px 50px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            gap: 30px;
            backdrop-filter: blur(10px);
        }

        .calc-results {
            background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
            padding: 40px;
            border-radius: 30px;
            border: 1px solid var(--border-color);
            box-shadow: 0 20px 50px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
        }

        .input-box {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .input-label-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .input-label-row label {
            font-size: 15px;
            font-weight: 600;
            color: var(--text-secondary);
        }

        .input-value-display {
            background: rgba(99, 102, 241, 0.1);
            color: var(--primary-600);
            padding: 6px 14px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
        }

        /* PREMIUM SLIDERS */
        .premium-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 6px;
            border-radius: 5px;
            background: var(--border-light);
            outline: none;
            margin: 10px 0;
        }

        .premium-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--primary-600);
            cursor: pointer;
            border: 4px solid #fff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .premium-slider::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
        }

        /* RESULT CARDS */
        .result-item {
            width: 100%;
            padding: 15px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-light);
        }

        .result-label {
            color: var(--text-secondary);
            font-weight: 500;
        }

        .result-value {
            font-weight: 700;
            color: var(--text-primary);
        }

        .main-result-card {
            width: 100%;
            background: rgba(99, 102, 241, 0.05);
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            margin-bottom: 30px;
            border: 1px solid rgba(99, 102, 241, 0.1);
        }

        .main-result-card .result-label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .main-result-card .result-value {
            font-size: 32px;
            color: var(--primary-600);
            display: block;
        }

        .chart-container {
            width: 100%;
            max-width: 280px;
            height: 280px;
            margin-top: 20px;
        }

        .btn-back-suite {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            color: var(--text-primary);
            font-weight: 600;
            margin-bottom: 30px;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .btn-back-suite:hover {
            background: var(--primary-50);
            color: var(--primary-600);
            border-color: var(--primary-200);
            transform: translateX(-5px);
        }

        [data-theme='dark'] .input-value-display {
            background: rgba(99, 102, 241, 0.2);
            color: #818cf8;
        }
        
        @media (max-width: 768px) {
            .calculator-layout {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(style);
}

function renderCalculatorsHub() {
    injectPremiumCalculatorStyles();
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'Financial Calculators');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (document.getElementById('navCalculators')) document.getElementById('navCalculators').classList.add('active');

    container.innerHTML = `
        <div class="calculators-hub-container animate-fade-in" style="padding: 20px 0;">
            <div class="section-header" style="margin-bottom: 40px; text-align: center;">
                <h1 style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, var(--primary-600), #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px;">Financial Suite</h1>
                <p style="color: var(--text-secondary); font-size: 16px;">Maximize your wealth with our premium precision tools.</p>
            </div>
            
            <div class="calc-grid-wrapper">
                <div class="calc-category-section">
                    <h3 class="calc-section-title"><i class="fas fa-chart-pie"></i> Investments</h3>
                    <div class="cards-grid">
                        <div class="action-card calc-card glass-card" onclick="renderSIPCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff;">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>SIP</h4>
                                <p>Monthly Investment</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderLumpsumCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #10b981, #3b82f6); color: #fff;">
                                <i class="fas fa-coins"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>Lumpsum</h4>
                                <p>One-time Investment</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderPPFCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff;">
                                <i class="fas fa-piggy-bank"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>PPF</h4>
                                <p>Provident Fund</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderRDCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #fff;">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>RD</h4>
                                <p>Recurring Deposit</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderSSYCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #f43f5e, #fb7185); color: #fff;">
                                <i class="fas fa-child"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>SSY</h4>
                                <p>Sukanya Samriddhi</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderNPSCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #ea580c, #f59e0b); color: #fff;">
                                <i class="fas fa-user-shield"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>NPS</h4>
                                <p>National Pension</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="calc-category-section" style="margin-top: 40px;">
                    <h3 class="calc-section-title"><i class="fas fa-hand-holding-usd"></i> Loans & Planning</h3>
                    <div class="cards-grid">
                        <div class="action-card calc-card glass-card" onclick="renderEMICalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #3b82f6, #06b6d4); color: #fff;">
                                <i class="fas fa-calculator"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>EMI</h4>
                                <p>Equated Installment</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderHomeLoanEMICalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #059669, #10b981); color: #fff;">
                                <i class="fas fa-home"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>Home Loan</h4>
                                <p>Property EMI</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderSWPCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #8b5cf6, #d946ef); color: #fff;">
                                <i class="fas fa-wallet"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>SWP</h4>
                                <p>Systematic Withdrawal</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderCAGRCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #f97316, #facc15); color: #fff;">
                                <i class="fas fa-percentage"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>CAGR</h4>
                                <p>Annual Growth</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="calc-category-section" style="margin-top: 40px;">
                    <h3 class="calc-section-title"><i class="fas fa-file-invoice-dollar"></i> Tax & Others</h3>
                    <div class="cards-grid">
                        <div class="action-card calc-card glass-card" onclick="renderGSTCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #ef4444, #f97316); color: #fff;">
                                <i class="fas fa-receipt"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>GST</h4>
                                <p>Tax Calculation</p>
                            </div>
                        </div>
                        <div class="action-card calc-card glass-card" onclick="renderIncomeTaxCalculator()">
                            <div class="calc-icon-circle" style="background: linear-gradient(135deg, #4b5563, #9ca3af); color: #fff;">
                                <i class="fas fa-landmark"></i>
                            </div>
                            <div class="calc-card-info">
                                <h4>Income Tax</h4>
                                <p>New Regime 24-25</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .calc-section-title {
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
                padding-left: 5px;
            }
            .calc-section-title i {
                color: var(--primary-500);
            }
            
            .glass-card {
                background: rgba(255, 255, 255, 0.7) !important;
                backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.4) !important;
                padding: 24px !important;
                border-radius: 20px !important;
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                text-align: left !important;
                gap: 18px !important;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
            }
            
            [data-theme='dark'] .glass-card {
                background: rgba(30, 41, 59, 0.6) !important;
                border: 1px solid rgba(255, 255, 255, 0.08) !important;
            }
            
            .calc-card:hover {
                transform: translateY(-5px) scale(1.03) !important;
                background: rgba(255, 255, 255, 0.9) !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
                border-color: var(--primary-300) !important;
            }
            
            [data-theme='dark'] .calc-card:hover {
                background: rgba(51, 65, 85, 0.8) !important;
            }
            
            .calc-icon-circle {
                width: 54px;
                height: 54px;
                min-width: 54px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
            }
            
            .calc-card-info h4 {
                font-size: 17px;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0;
            }
            .calc-card-info p {
                font-size: 12px;
                color: var(--text-tertiary);
                margin: 0;
                line-height: 1.4;
            }
            
            /* Calculator Page Styles Update */
            .calculator-layout {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin-top: 20px;
                animation: translateY 0.5s ease-out;
            }
            
            .calc-inputs {
                display: flex;
                flex-direction: column;
                gap: 28px;
                padding: 35px;
                background: var(--bg-secondary);
                border-radius: 24px;
                border: 1px solid var(--border-color);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            }
            
            .calc-results {
                padding: 35px;
                background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
                border-radius: 24px;
                border: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            }
            
            .input-box {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .premium-slider {
                -webkit-appearance: none;
                width: 100%;
                height: 8px;
                border-radius: 10px;
                background: var(--border-color);
                outline: none;
                cursor: pointer;
            }
            
            .premium-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: var(--primary-600);
                border: 4px solid #fff;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                transition: transform 0.2s;
            }
            
            .premium-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
            }
            
            .result-item {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 0;
                border-bottom: 1px solid var(--border-color);
            }
            
            .chart-container {
                width: 100%;
                max-width: 260px;
                height: 260px;
                margin-top: 30px;
                position: relative;
            }
            
            @keyframes translateY {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    `;
}

// Global chart instance
let calcChart = null;

function renderLumpsumCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'Lumpsum Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">Lumpsum</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">One-time Wealth Generation</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Total Investment</label>
                            <span class="input-value-display">₹ <span id="val-amount">25,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="1000" max="10000000" step="1000" value="25000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Expected Return Rate (p.a)</label>
                            <span class="input-value-display"><span id="val-rate">12</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="30" step="0.5" value="12">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">10</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="40" step="1" value="10">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card">
                        <span class="result-label">Total Value</span>
                        <span class="result-value" id="res-total-value">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Invested Amount</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Est. Returns</span>
                        <span class="result-value" id="res-total-interest" style="color: #10B981;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="lumpsumChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('Lumpsum');
}

function renderSWPCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'SWP Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">SWP Plan</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Systematic Withdrawal Plan</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Total Investment</label>
                            <span class="input-value-display">₹ <span id="val-amount">500,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="10000" max="10000000" step="10000" value="500000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Monthly Withdrawal</label>
                            <span class="input-value-display">₹ <span id="val-rate">5,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="500" max="100000" step="500" value="5000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Expected Return Rate (p.a)</label>
                            <span class="input-value-display"><span id="val-years">8</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="20" step="0.5" value="8">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-time">10</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-time" min="1" max="30" step="1" value="10">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(139, 92, 246, 0.1);">
                        <span class="result-label">Final Value</span>
                        <span class="result-value" id="res-final-value" style="color: #7C3AED;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Total Investment</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Withdrawal</span>
                        <span class="result-value" id="res-total-withdrawal">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="swpChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('SWP');
}

function renderRDCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'RD Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">Recurring Deposit</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Disciplined Monthly Savings</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Monthly Deposit</label>
                            <span class="input-value-display">₹ <span id="val-amount">5,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="500" max="100000" step="500" value="5000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Rate of Interest (p.a)</label>
                            <span class="input-value-display"><span id="val-rate">6.5</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="15" step="0.1" value="6.5">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">5</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="25" step="1" value="5">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(236, 72, 153, 0.1);">
                        <span class="result-label">Maturity Value</span>
                        <span class="result-value" id="res-total-value" style="color: #DB2777;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Invested Amount</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Est. Returns</span>
                        <span class="result-value" id="res-total-interest" style="color: #10B981;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="rdChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('RD');
}

function renderCAGRCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'CAGR Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">CAGR</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Compound Annual Growth Rate</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Initial Investment</label>
                            <span class="input-value-display">₹ <span id="val-amount">100,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="1000" max="10000000" step="1000" value="100000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Final Value</label>
                            <span class="input-value-display">₹ <span id="val-rate">250,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1000" max="20000000" step="1000" value="250000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">5</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="40" step="1" value="5">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(249, 115, 22, 0.1);">
                        <span class="result-label">Your CAGR is</span>
                        <span class="result-value" id="res-cagr-value" style="color: #EA580C; font-size: 42px;">0%</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Absolute Returns</span>
                        <span class="result-value" id="res-abs-return">0%</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Gain</span>
                        <span class="result-value" id="res-total-gain" style="color: #10B981;">₹ 0</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('CAGR');
}

function renderGSTCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'GST Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs" id="gstContainer">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">GST</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Goods and Services Tax</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Total Amount (₹)</label>
                            <span class="input-value-display">₹ <span id="val-amount">10,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="100" max="1000000" step="100" value="10000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Tax Rate (%)</label>
                            <span class="input-value-display"><span id="val-rate">18</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="0" max="28" step="1" value="18">
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button class="btn-primary gst-toggle active" style="flex:1" onclick="toggleGSTMode(this, 'exclusive')">GST Exclusive</button>
                        <button class="btn-primary gst-toggle" style="flex:1" onclick="toggleGSTMode(this, 'inclusive')">GST Inclusive</button>
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(239, 68, 68, 0.1);">
                        <span class="result-label" id="label-total">Total Amount</span>
                        <span class="result-value" id="res-total-amount" style="color: #DC2626;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label" id="label-net">Net Amount</span>
                        <span class="result-value" id="res-net-amount">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">GST Amount</span>
                        <span class="result-value" id="res-gst-amount" style="color: #EF4444;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="gstChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .gst-toggle {
                padding: 12px !important;
                font-size: 14px !important;
                background: var(--bg-primary) !important;
                color: var(--text-secondary) !important;
                border: 1px solid var(--border-color) !important;
                border-radius: 12px !important;
                font-weight: 600 !important;
            }
            .gst-toggle.active {
                background: var(--primary-600) !important;
                color: #fff !important;
                border-color: var(--primary-600) !important;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3) !important;
            }
        </style>
    `;

    setupCalculatorLogic('GST');
}

function renderSSYCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'SSY Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">Sukanya Samriddhi</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Girl Child Prosperity Scheme</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Yearly Investment</label>
                            <span class="input-value-display">₹ <span id="val-amount">50,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="250" max="150000" step="250" value="50000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Rate of Interest (%)</label>
                            <span class="input-value-display"><span id="val-rate">8.2</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="15" step="0.1" value="8.2">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">15</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="15" step="1" value="15">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(244, 63, 94, 0.1);">
                        <span class="result-label">Maturity Value</span>
                        <span class="result-value" id="res-total-value" style="color: #E11D48;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Total Investment</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Interest</span>
                        <span class="result-value" id="res-total-interest" style="color: #10B981;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="ssyChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('SSY');
}

function renderPPFCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'PPF Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">Public Provident Fund</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Tax-free Compounding</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Yearly Investment</label>
                            <span class="input-value-display">₹ <span id="val-amount">50,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="500" max="150000" step="500" value="50000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Rate of Interest (%)</label>
                            <span class="input-value-display"><span id="val-rate">7.1</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="12" step="0.1" value="7.1">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">15</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="15" max="50" step="1" value="15">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(245, 158, 11, 0.1);">
                        <span class="result-label">Maturity Value</span>
                        <span class="result-value" id="res-total-value" style="color: #D97706;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Total Investment</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Interest</span>
                        <span class="result-value" id="res-total-interest" style="color: #10B981;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="ppfChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('PPF');
}

function renderNPSCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'NPS Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">National Pension</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Retirement Planning Tool</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Monthly Contribution</label>
                            <span class="input-value-display">₹ <span id="val-amount">10,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="500" max="150000" step="500" value="10000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Expected Return (%)</label>
                            <span class="input-value-display"><span id="val-rate">10</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="15" step="0.5" value="10">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Investment Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">25</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="40" step="1" value="25">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(234, 88, 12, 0.1);">
                        <span class="result-label">Total Corpus</span>
                        <span class="result-value" id="res-total-value" style="color: #C2410C;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Total Contributed</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Est. Returns</span>
                        <span class="result-value" id="res-total-interest" style="color: #10B981;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="npsChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('NPS');
}

function renderHomeLoanEMICalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'Home Loan EMI');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-outline" onclick="renderCalculatorsHub()" style="margin-bottom: 20px; border-radius: 12px; padding: 10px 20px;">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs" id="emiInputs">
                    <h3 style="margin-bottom: 20px; font-weight: 700;">Home Loan Details</h3>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Loan Amount</label>
                            <span class="input-value-display">₹ <span id="val-amount">5,000,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="100000" max="50000000" step="100000" value="5000000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Rate of Interest (%)</label>
                            <span class="input-value-display"><span id="val-rate">8.5</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="20" step="0.1" value="8.5">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Loan Tenure (Years)</label>
                            <span class="input-value-display"><span id="val-years">20</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="30" step="1" value="20">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="result-item" style="background: rgba(79, 70, 229, 0.05); padding: 25px; border-radius: 20px; margin-bottom: 20px; text-align: center; flex-direction: column; gap: 10px;">
                        <span class="result-label" style="font-weight: 600; color: var(--text-secondary);">Monthly EMI</span>
                        <span class="result-value" id="res-monthly-emi" style="color: var(--primary-600); font-size: 32px; border-bottom: none;">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Principal Amount</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Interest</span>
                        <span class="result-value" id="res-total-interest" style="color: #EF4444;">₹ 0</span>
                    </div>
                    <div class="result-item" style="border-top: 2px solid var(--primary-100); padding-top: 20px; margin-top: 10px;">
                        <span class="result-label" style="font-weight: 700; color: var(--text-primary); font-size: 16px;">Total Amount</span>
                        <span class="result-value" id="res-total-value" style="color: var(--primary-600); font-size: 26px;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="homeloanemiChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('EMI', 'homeloanemi'); // Use EMI logic
}

function renderIncomeTaxCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'Tax Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs" id="taxContainer">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">Income Tax</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">New Regime (FY 2024-25)</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Annual Salary (Gross)</label>
                            <span class="input-value-display">₹ <span id="val-amount">1,200,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="100000" max="10000000" step="50000" value="1200000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Other Income (p.a)</label>
                            <span class="input-value-display">₹ <span id="val-rate">0</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="0" max="2000000" step="10000" value="0">
                    </div>

                    <div class="tax-info-box" style="padding: 20px; background: rgba(99, 102, 241, 0.05); border-radius: 16px; border: 1px dashed var(--primary-200);">
                        <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                            <i class="fas fa-info-circle"></i> Standard deduction of <b>₹ 75,000</b> automatically applied as per New Tax Regime (Budget 2024).
                        </p>
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(16, 185, 129, 0.1);">
                        <span class="result-label">Net In-Hand (p.a)</span>
                        <span class="result-value" id="res-net-inhand" style="color: #059669;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Total Tax Payable</span>
                        <span class="result-value" id="res-tax-amount" style="color: #EF4444;">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Gross Income</span>
                        <span class="result-value" id="res-gross-income">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Taxable Income</span>
                        <span class="result-value" id="res-taxable-income">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="taxChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('Tax');
}

let gstMode = 'exclusive';
function toggleGSTMode(btn, mode) {
    document.querySelectorAll('.gst-toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gstMode = mode;

    // Trigger update
    const amtInput = document.getElementById('input-amount');
    const event = new Event('input');
    amtInput.dispatchEvent(event);
}

function renderSIPCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'SIP Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">SIP Investment</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Systematic Investment Plan</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Monthly Investment</label>
                            <span class="input-value-display">₹ <span id="val-amount">5,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="500" max="100000" step="500" value="5000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Expected Return Rate (p.a)</label>
                            <span class="input-value-display"><span id="val-rate">12</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="30" step="0.5" value="12">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">10</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="40" step="1" value="10">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card">
                        <span class="result-label">Total Value</span>
                        <span class="result-value" id="res-total-value">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Invested Amount</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Est. Returns</span>
                        <span class="result-value" id="res-total-interest" style="color: #10B981;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="sipChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('SIP');
}

function renderEMICalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'EMI Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">Loan EMI</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Standard Personal Loan</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Loan Amount</label>
                            <span class="input-value-display">₹ <span id="val-amount">1,000,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="100000" max="10000000" step="100000" value="1000000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Interest Rate (p.a)</label>
                            <span class="input-value-display"><span id="val-rate">8.5</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="5" max="25" step="0.1" value="8.5">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Loan Tenure (Years)</label>
                            <span class="input-value-display"><span id="val-years">20</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="30" step="1" value="20">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(79, 70, 229, 0.1);">
                        <span class="result-label">Monthly EMI</span>
                        <span class="result-value" id="res-monthly-emi">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Principal Amount</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Interest</span>
                        <span class="result-value" id="res-total-interest" style="color: #F59E0B;">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Payable</span>
                        <span class="result-value" id="res-total-value">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="emiChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('EMI');
}

function renderFDCalculator() {
    const container = document.getElementById('calculatorsView');
    if (!container) return;

    switchToView('calculatorsView', 'FD Calculator');

    container.innerHTML = `
        <div class="calculator-container animate-fade-in">
            <button class="btn-back-suite" onclick="renderCalculatorsHub()">
                <i class="fas fa-arrow-left"></i> Back to Suite
            </button>
            
            <div class="calculator-layout">
                <div class="calc-inputs">
                    <h3 style="margin-bottom: 10px; font-weight: 700;">Fixed Deposit</h3>
                    <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">Secure Savings Growth</p>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Deposit Amount</label>
                            <span class="input-value-display">₹ <span id="val-amount">100,000</span></span>
                        </div>
                        <input type="range" class="premium-slider" id="input-amount" min="1000" max="10000000" step="1000" value="100000">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Rate of Interest (p.a)</label>
                            <span class="input-value-display"><span id="val-rate">7</span> %</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-rate" min="1" max="15" step="0.1" value="7">
                    </div>
                    
                    <div class="input-box">
                        <div class="input-label-row">
                            <label>Time Period (Years)</label>
                            <span class="input-value-display"><span id="val-years">5</span> Yrs</span>
                        </div>
                        <input type="range" class="premium-slider" id="input-years" min="1" max="25" step="1" value="5">
                    </div>
                </div>
                
                <div class="calc-results">
                    <div class="main-result-card" style="background: rgba(16, 185, 129, 0.1);">
                        <span class="result-label">Maturity Value</span>
                        <span class="result-value" id="res-total-value" style="color: #059669;">₹ 0</span>
                    </div>

                    <div class="result-item">
                        <span class="result-label">Invested Amount</span>
                        <span class="result-value" id="res-total-invest">₹ 0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Interest</span>
                        <span class="result-value" id="res-total-interest" style="color: #10B981;">₹ 0</span>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="fdChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupCalculatorLogic('FD');
}

function setupCalculatorLogic(type, customCanvasId) {
    const amtInput = document.getElementById('input-amount');
    const rateInput = document.getElementById('input-rate');
    const yrsInput = document.getElementById('input-years') || document.getElementById('input-time');

    const amtDisp = document.getElementById('val-amount');
    const rateDisp = document.getElementById('val-rate');
    const yrsDisp = document.getElementById('val-years') || document.getElementById('val-time');

    const update = () => {
        const p = parseFloat(amtInput.value);
        const r = parseFloat(rateInput.value);
        const n = yrsInput ? parseFloat(yrsInput.value) : 0;

        if (amtDisp) amtDisp.textContent = p.toLocaleString('en-IN');
        if (rateDisp) rateDisp.textContent = r;
        if (yrsDisp) yrsDisp.textContent = n;

        let invested = 0;
        let interest = 0;
        let total = 0;
        let monthlyEmi = 0;
        let withdrawal = 0;
        let extra = 0;

        if (type === 'PPF') {
            invested = p * n;
            const rate = r / 100;
            total = p * (Math.pow(1 + rate, n) - 1) / rate * (1 + rate);
            interest = total - invested;
        } else if (type === 'SIP') {
            invested = p * n * 12;
            const monthlyRate = r / 12 / 100;
            const months = n * 12;
            total = p * [Math.pow(1 + monthlyRate, months) - 1] / monthlyRate * (1 + monthlyRate);
            interest = total - invested;
        } else if (type === 'Lumpsum') {
            invested = p;
            total = p * Math.pow(1 + (r / 100), n);
            interest = total - invested;
        } else if (type === 'EMI') {
            invested = p;
            const monthlyRate = r / 12 / 100;
            const months = n * 12;
            monthlyEmi = (p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
            total = monthlyEmi * months;
            interest = total - invested;
            const emiEl = document.getElementById('res-monthly-emi');
            if (emiEl) emiEl.textContent = '₹ ' + Math.round(monthlyEmi).toLocaleString('en-IN');
        } else if (type === 'FD') {
            invested = p;
            total = p * Math.pow(1 + (r / 100), n);
            interest = total - invested;
        } else if (type === 'RD') {
            invested = p * n * 12;
            const monthlyRate = r / 12 / 100;
            const months = n * 12;
            total = p * (Math.pow(1 + monthlyRate, months) - 1) / (1 - Math.pow(1 + monthlyRate, -1 / 12));
            interest = total - invested;
        } else if (type === 'SSY') {
            invested = p * n;
            const rate = r / 100;
            total = p * (Math.pow(1 + rate, n) - 1) / rate * (1 + rate);
            const remainingYears = 21 - n;
            total = total * Math.pow(1 + rate, remainingYears);
            interest = total - invested;
        } else if (type === 'NPS') {
            invested = p * n * 12;
            const monthlyRate = r / 12 / 100;
            const months = n * 12;
            total = p * [Math.pow(1 + monthlyRate, months) - 1] / monthlyRate * (1 + monthlyRate);
            interest = total - invested;
        } else if (type === 'SWP') {
            invested = p;
            withdrawal = r;
            const rateInput = document.getElementById('input-years');
            const rate = rateInput ? parseFloat(rateInput.value) / 100 : 0;
            const time = n;
            const monthlyRate = rate / 12;
            const months = time * 12;
            total = invested * Math.pow(1 + monthlyRate, months) - (withdrawal * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
            interest = (withdrawal * months) + (total > 0 ? total : 0) - invested;
            const withdrawalTotal = withdrawal * months;
            document.getElementById('res-total-withdrawal').textContent = '₹ ' + Math.round(withdrawalTotal).toLocaleString('en-IN');
            document.getElementById('res-final-value').textContent = '₹ ' + Math.round(Math.max(0, total)).toLocaleString('en-IN');
            updateCalcChart(type, invested, Math.max(0, total), customCanvasId);
            return;
        } else if (type === 'CAGR') {
            const initial = p;
            const final = r;
            const years = n;
            const cagr = (Math.pow(final / initial, 1 / years) - 1) * 100;
            document.getElementById('res-cagr-value').textContent = cagr.toFixed(2) + '%';
            document.getElementById('res-abs-return').textContent = (((final / initial) - 1) * 100).toFixed(2) + '%';
            document.getElementById('res-total-gain').textContent = '₹ ' + (final - initial).toLocaleString('en-IN');
            return;
        } else if (type === 'GST') {
            const amount = p;
            const rate = r;
            let gst = 0;
            let net = 0;
            let totalAmt = 0;
            if (gstMode === 'exclusive') {
                gst = amount * (rate / 100);
                net = amount;
                totalAmt = amount + gst;
            } else {
                totalAmt = amount;
                net = amount / (1 + (rate / 100));
                gst = amount - net;
            }
            document.getElementById('res-net-amount').textContent = '₹ ' + Math.round(net).toLocaleString('en-IN');
            document.getElementById('res-gst-amount').textContent = '₹ ' + Math.round(gst).toLocaleString('en-IN');
            document.getElementById('res-total-amount').textContent = '₹ ' + Math.round(totalAmt).toLocaleString('en-IN');
            updateCalcChart(type, net, gst, customCanvasId);
            return;
        } else if (type === 'Tax') {
            const gross = p + r;
            const taxable = Math.max(0, gross - 75000);
            let tax = 0;
            if (taxable > 300000) {
                if (taxable <= 700000) tax = (taxable - 300000) * 0.05;
                else {
                    tax = 400000 * 0.05;
                    if (taxable <= 1000000) tax += (taxable - 700000) * 0.10;
                    else {
                        tax += 300000 * 0.10;
                        if (taxable <= 1200000) tax += (taxable - 1000000) * 0.15;
                        else {
                            tax += 200000 * 0.15;
                            if (taxable <= 1500000) tax += (taxable - 1200000) * 0.20;
                            else {
                                tax += 300000 * 0.20;
                                tax += (taxable - 1500000) * 0.30;
                            }
                        }
                    }
                }
            }
            if (taxable <= 700000) tax = 0;
            const cess = tax * 0.04;
            const totalTax = tax + cess;
            document.getElementById('res-tax-amount').textContent = '₹ ' + Math.round(totalTax).toLocaleString('en-IN');
            document.getElementById('res-gross-income').textContent = '₹ ' + Math.round(gross).toLocaleString('en-IN');
            document.getElementById('res-taxable-income').textContent = '₹ ' + Math.round(taxable).toLocaleString('en-IN');
            document.getElementById('res-net-inhand').textContent = '₹ ' + Math.round(gross - totalTax).toLocaleString('en-IN');
            updateCalcChart(type, gross - totalTax, totalTax, customCanvasId);
            return;
        }

        const resInvest = document.getElementById('res-total-invest');
        const resInterest = document.getElementById('res-total-interest');
        const resTotal = document.getElementById('res-total-value');

        if (resInvest) resInvest.textContent = '₹ ' + Math.round(invested).toLocaleString('en-IN');
        if (resInterest) resInterest.textContent = '₹ ' + Math.round(interest).toLocaleString('en-IN');
        if (resTotal) resTotal.textContent = '₹ ' + Math.round(total).toLocaleString('en-IN');

        updateCalcChart(type, invested, interest, customCanvasId);
    };

    amtInput.addEventListener('input', update);
    rateInput.addEventListener('input', update);
    if (yrsInput) yrsInput.addEventListener('input', update);

    update(); // Initial run
}

function updateCalcChart(type, invested, interest) {
    const canvasId = type.toLowerCase() + 'Chart';
    // Special handling for homeloanemi and other subtypes if needed
    const actualId = document.getElementById(canvasId) ? canvasId : (type === 'EMI' ? 'homeloanemiChart' : canvasId);
    const canvas = document.getElementById(actualId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (calcChart) calcChart.destroy();

    const isEMI = type === 'EMI';
    const isGST = type === 'GST';
    const isSWP = type === 'SWP';
    const isTax = type === 'Tax';
    const isSSY = type === 'SSY';
    const isNPS = type === 'NPS';
    const isPPF = type === 'PPF';

    let label1 = 'Invested Amount';
    let label2 = 'Est. Returns';
    let color1 = 'rgba(99, 102, 241, 0.85)';
    let color2 = 'rgba(16, 185, 129, 0.85)';

    if (isEMI) {
        label1 = 'Loan Amount';
        label2 = 'Total Interest';
        color2 = 'rgba(245, 158, 11, 0.85)';
    } else if (isGST) {
        label1 = 'Net Amount';
        label2 = 'GST Amount';
        color2 = 'rgba(239, 68, 68, 0.85)';
    } else if (isSWP) {
        label1 = 'Principal';
        label2 = 'Final Value';
        color2 = 'rgba(139, 92, 246, 0.85)';
    } else if (isTax) {
        label1 = 'Net Income';
        label2 = 'Income Tax';
        color1 = 'rgba(16, 185, 129, 0.85)';
        color2 = 'rgba(239, 68, 68, 0.85)';
    } else if (isSSY || isNPS || isPPF) {
        label1 = 'Total Invested';
        label2 = 'Est. Returns';
    }

    calcChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [label1, label2],
            datasets: [{
                data: [invested, interest],
                backgroundColor: [color1, color2],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { size: 11, weight: '600' },
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    borderRadius: 10,
                    callbacks: {
                        label: function (item) {
                            return ' ₹ ' + Math.round(item.raw).toLocaleString('en-IN');
                        }
                    }
                }
            },
            cutout: '75%'
        }
    });
}


