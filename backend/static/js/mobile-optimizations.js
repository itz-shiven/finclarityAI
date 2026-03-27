/**
 * FINCLARITY AI - Mobile Interactions
 * Handles sidebar toggling and mobile-specific UI logic.
 */
document.addEventListener('DOMContentLoaded', () => {
    const isMobileViewport = () => window.innerWidth <= 1024;
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileChatHeaderCloseBtn = document.getElementById('mobileChatHeaderCloseBtn');
    const sidebar = document.querySelector('.sidebar');
    const mobileOverlay = document.querySelector('.mobile-overlay');
    const chatWindow = document.getElementById('chatWindow');
    const chatInput = document.getElementById('chatInput');

    const updateChatViewportHeight = () => {
        if (!isMobileViewport()) {
            document.documentElement.style.removeProperty('--chat-mobile-height');
            return;
        }

        const viewportHeight = window.visualViewport
            ? Math.round(window.visualViewport.height)
            : window.innerHeight;

        document.documentElement.style.setProperty('--chat-mobile-height', `${viewportHeight}px`);
    };

    const isAnyModalOpen = () => Boolean(document.querySelector('.modal-overlay.show'));

    const syncMobileShellState = () => {
        const sidebarOpen = Boolean(sidebar && sidebar.classList.contains('mobile-active') && isMobileViewport());
        const chatOpen = Boolean(chatWindow && chatWindow.classList.contains('open') && isMobileViewport());
        const modalOpen = Boolean(isAnyModalOpen() && isMobileViewport());

        document.body.classList.toggle('mobile-sidebar-open', sidebarOpen);
        document.body.classList.toggle('chat-mobile-open', chatOpen || sidebarOpen || modalOpen);
        mobileChatHeaderCloseBtn?.classList.toggle('is-visible', chatOpen);
    };

    const syncMobileChatViewport = () => {
        updateChatViewportHeight();
        syncMobileShellState();
    };

    const scrollChatToBottom = () => {
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) return;

        requestAnimationFrame(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
    };

    const resetMobileMenuIcon = () => {
        const icon = mobileMenuBtn?.querySelector('i');
        if (!icon) return;

        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    };

    const closeMobileSidebar = () => {
        if (!sidebar || !mobileOverlay) return;

        sidebar.classList.remove('mobile-active');
        mobileOverlay.classList.remove('active');
        resetMobileMenuIcon();
        syncMobileShellState();
    };

    const openMobileSidebar = () => {
        if (!sidebar || !mobileOverlay) return;

        sidebar.classList.remove('collapsed');
        document.querySelector('.dashboard-container')?.classList.remove('collapsed');
        sidebar.classList.add('mobile-active');
        mobileOverlay.classList.add('active');

        const icon = mobileMenuBtn?.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        }

        syncMobileShellState();
    };

    if (mobileMenuBtn && sidebar && mobileOverlay) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar.classList.contains('mobile-active')) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });

        mobileOverlay.addEventListener('click', closeMobileSidebar);

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth > 1024) return;
                closeMobileSidebar();
            });
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeMobileSidebar();
        } else {
            sidebar?.classList.remove('collapsed');
            document.querySelector('.dashboard-container')?.classList.remove('collapsed');
        }
    });

    document.querySelector('.main-content')?.addEventListener('click', () => {
        if (!isMobileViewport() || !sidebar?.classList.contains('mobile-active')) return;
        closeMobileSidebar();
    });

    const mobileChatHistoryBtn = document.getElementById('mobileChatHistoryBtn');
    const mobileChatCloseBtn = document.getElementById('mobileChatCloseBtn');
    const chatCloseBtn = document.getElementById('chatCloseBtn');

    mobileChatHeaderCloseBtn?.addEventListener('click', () => {
        if (!chatWindow?.classList.contains('open')) return;

        if (chatCloseBtn) {
            chatCloseBtn.click();
        } else {
            document.getElementById('chatToggleBtn')?.click();
        }
    });

    if (mobileChatHistoryBtn && chatWindow) {
        mobileChatHistoryBtn.addEventListener('click', () => {
            if (sidebar?.classList.contains('mobile-active')) return;
            chatWindow.classList.add('show-history');
        });
    }

    if (mobileChatCloseBtn && chatWindow) {
        mobileChatCloseBtn.addEventListener('click', () => {
            if (chatCloseBtn) {
                chatCloseBtn.click();
            } else {
                document.getElementById('chatToggleBtn')?.click();
            }
        });
    }

    const historyList = document.querySelector('.history-list');
    if (historyList && chatWindow) {
        historyList.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && e.target.closest('.history-item')) {
                chatWindow.classList.remove('show-history');
                scrollChatToBottom();
            }
        });
    }

    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            if (!isMobileViewport()) return;

            document.body.classList.add('chat-mobile-open');
            setTimeout(() => {
                syncMobileChatViewport();
                scrollChatToBottom();
            }, 250);
        });

        chatInput.addEventListener('blur', () => {
            if (!isMobileViewport()) return;

            setTimeout(syncMobileChatViewport, 150);
        });
    }

    if (chatWindow) {
        const observer = new MutationObserver(syncMobileChatViewport);
        observer.observe(chatWindow, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        const observer = new MutationObserver(syncMobileChatViewport);
        observer.observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });
    });

    const handleViewportChange = () => {
        syncMobileChatViewport();
        if (chatWindow?.classList.contains('open')) {
            scrollChatToBottom();
        }
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);

    if (isMobileViewport()) {
        sidebar?.classList.remove('collapsed');
        document.querySelector('.dashboard-container')?.classList.remove('collapsed');
    }

    syncMobileChatViewport();
});
