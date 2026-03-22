document.addEventListener('DOMContentLoaded', async function () {

    await checkSupabaseAuth();
    await loadUserData();

    if (typeof loadLocalChats === 'function') loadLocalChats();

    initializeDashboard();
    setupSettingsAndLogout();
    setupProfileModal();
    setupAdvancedNavigation();
});


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
    setupSidebarToggle();
    setupNavigation();
    setupChatPanel();
    setupChatInput();
    setupActionCards();
    setupResponsive();
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
        // Maintain local history state
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

        removeLoader(loaderId);

        if (!response.ok) {
            if (response.status === 401) {
                appendMessage("Please log in to use the AI Assistant", "ai");
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        let reply = data?.reply || "No response from AI.";
        
        // Extract permanent memory facts secretly
        const memoryMatches = reply.match(/\[MEMORY:(.*?)\]/g);
        if (memoryMatches) {
            let memories = JSON.parse(localStorage.getItem(getUserKey('finclarityMemory')) || '[]');
            memoryMatches.forEach(match => {
                const fact = match.replace('[MEMORY:', '').replace(']', '').trim();
                if (!memories.includes(fact)) memories.push(fact);
            });
            localStorage.setItem(getUserKey('finclarityMemory'), JSON.stringify(memories));
            if (typeof syncUserDataToBackend === 'function') syncUserDataToBackend();
            
            // Strip the tags from the visual UI
            reply = reply.replace(/\[MEMORY:(.*?)\]/g, '').trim();
        }

        if (reply === "") reply = "Okay, I'll remember that for the future!";

        appendMessage(reply, "ai");
        currentConversation.push({ role: "assistant", content: reply });

    } catch (error) {
        removeLoader(loaderId);
        console.error("Chat error:", error);
        appendMessage("Something went wrong. Try again.", "ai");
    }
}


function appendMessage(text, sender) {

    let chatBox = document.getElementById('chatMessages');
    if (!chatBox) return;

    let newChatArea = document.getElementById('newChatArea');
    if (newChatArea && newChatArea.style.display !== 'none') {
        newChatArea.style.display = 'none';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;

    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = `bubble-wrapper ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${sender}`;
    
    if (sender === 'ai' && window.marked) {
        let i = 0;
        const speed = 15;
        bubble.innerHTML = '';
        
        bubbleWrapper.appendChild(bubble);
        messageDiv.appendChild(bubbleWrapper);
        chatBox.appendChild(messageDiv);

        function typeWriter() {
            if (i < text.length) {
                i += 2;
                if (i > text.length) i = text.length;
                
                bubble.innerHTML = marked.parse(text.substring(0, i));
                // scrollToBottom() removed to keep screen static during AI typing as per user request
                
                setTimeout(typeWriter, speed);
            } else {
                if (typeof saveCurrentChat === 'function') {
                    saveCurrentChat();
                }
            }
        }
        typeWriter();
    } else {
        bubble.textContent = text;
        bubbleWrapper.appendChild(bubble);

        if (sender === 'user') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'message-action-btn';
            copyBtn.innerHTML = '<i class="far fa-copy"></i>';
            copyBtn.title = 'Copy';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(text);
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { copyBtn.innerHTML = '<i class="far fa-copy"></i>'; }, 2000);
            };

            const editBtn = document.createElement('button');
            editBtn.className = 'message-action-btn';
            editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
            editBtn.title = 'Edit';
            editBtn.onclick = () => {
                showInlineEdit(messageDiv, bubble, text);
            };

            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(editBtn);
            bubbleWrapper.appendChild(actionsDiv);
        }

        messageDiv.appendChild(bubbleWrapper);
        chatBox.appendChild(messageDiv);
        
        // Store index for future editing
        messageDiv.dataset.index = currentConversation.length - 1;
        scrollToBottom();
    }

    if (typeof saveCurrentChat === 'function') {
        saveCurrentChat();
    }
}

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

    const firstUserMsg = chatMessages.querySelector('.chat-message.user .message-bubble');
    if (!firstUserMsg) return;

    const title = firstUserMsg.textContent.trim();
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
    if (confirm("Are you sure you want to delete this chat?")) {
        chatHistories = chatHistories.filter(c => c.id !== chatId);
        if (currentChatId === chatId) {
            currentChatId = null;
            currentConversation = [];
            document.getElementById('chatMessages').innerHTML = '';
            document.getElementById('newChatArea').style.display = 'flex';
        }
        saveLocalChats();
        loadLocalChats();
    }
}

// Global listener to close history dropdowns
document.addEventListener('click', function() {
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
                            
                            // Re-load chats into the local state
                            if (typeof loadLocalChats === 'function') loadLocalChats();
                        }
                    } catch (e) {
                        console.error("Failed to load user data from backend", e);
                    }
                }
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
            body: JSON.stringify({ chats, memory })
        });
    } catch (e) {
        console.error("Failed to sync data to backend", e);
    }
}


// ============================================
// PLACEHOLDERS
// ============================================

function setupSidebarToggle() { }
function setupNavigation() { }
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
function setupActionCards() { }
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
        profileBtn.addEventListener('click', (e) => {
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

            try {
                const res = await fetch('/change_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                const data = await res.json();
                if (data.status === 'success') {
                    btn.textContent = 'Password Changed';
                    btn.style.borderColor = '#4caf50';
                    btn.style.color = '#4caf50';
                    changePasswordForm.reset();

                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.borderColor = '';
                        btn.style.color = '';
                        btn.disabled = false;
                    }, 2500);
                } else {
                    alert(data.message || 'Error changing password');
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

function setupAdvancedNavigation() {
    const mainView = document.getElementById('mainView');
    if (!mainView) return;

    // Initialize standard view transitions explicitly
    document.querySelectorAll('#mainView, .sub-view-grid, #featureDisplayView').forEach(v => {
        v.style.transition = 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out';
    });

    // Set base stack
    navStack = [{ id: 'mainView', title: 'Home' }];

    // Level 1: Category Cards click listeners (Main grid)
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const targetId = card.getAttribute('data-target');
            const targetTitle = card.getAttribute('data-title');
            navigateTo(targetId, targetTitle);
        });
    });

    // Level 2: Sub-view specific action cards click listeners
    // Filtering out the provider Selection view and only grabbing categories
    document.querySelectorAll('.sub-view-grid .action-card').forEach(card => {
        // Skip provider cards just in case they are generated later
        if (card.classList.contains('provider-card')) return;

        card.addEventListener('click', () => {
            const featureTitle = card.querySelector('span').textContent;
            openProviderSelection(featureTitle);
        });
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

    // Determine which category we came from to show contextual providers
    let mainCategory = 'default';
    if (navStack.length >= 2) {
        mainCategory = navStack[1].title;
    }

    // Fallback to default banks if category doesn't have a specific list
    const listToUse = providersData[mainCategory] || providersData['default'];

    // Adjust wording based on category
    let providerTypeTerm = "Provider";
    if (mainCategory === 'Stock Market') providerTypeTerm = "Broker";
    if (mainCategory === 'Crypto') providerTypeTerm = "Exchange/Wallet";
    if (mainCategory === 'Insurance') providerTypeTerm = "Insurer";

    subtitle.textContent = `Select a ${providerTypeTerm} for ${featureTitle}`;
    providerGrid.innerHTML = '';

    listToUse.forEach(provider => {
        const card = document.createElement('div');
        card.className = 'action-card provider-card';
        card.innerHTML = `<i class="${provider.icon}"></i><span>${provider.name}</span>`;

        card.addEventListener('click', () => {
            openFeatureDisplay(provider.name, featureTitle);
        });

        providerGrid.appendChild(card);
    });

    navigateTo('providerSelectionView', featureTitle);
}

function openFeatureDisplay(providerName, featureTitle) {
    const featureTitleEl = document.getElementById('featureTitle');
    const featureIconEl = document.getElementById('featureProviderIcon');

    if (featureTitleEl && featureIconEl) {
        featureTitleEl.textContent = `${providerName} - ${featureTitle}`;
        featureIconEl.textContent = providerName.charAt(0);

        const colors = ['#4B1E6D', '#1976D2', '#388E3C', '#E64A19', '#0097A7', '#F57C00'];
        featureIconEl.style.background = colors[providerName.length % colors.length];
    }

    navigateTo('featureDisplayView', providerName);
}

console.log('Finclarity AI Dashboard main logic initialized');