/**
 * FINCLARITY AI - Mobile Interactions
 * Handles sidebar toggling and mobile-specific UI logic.
 */
document.addEventListener('DOMContentLoaded', () => {
    const isMobileViewport = () => window.innerWidth <= 1024;
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
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

    const syncMobileChatLock = () => {
        const shouldLock = Boolean(
            chatWindow &&
            chatWindow.classList.contains('open') &&
            isMobileViewport()
        );

        document.body.classList.toggle('chat-mobile-open', shouldLock);
    };

    const syncMobileChatViewport = () => {
        updateChatViewportHeight();
        syncMobileChatLock();
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

    if (mobileMenuBtn && sidebar && mobileOverlay) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-active');
            mobileOverlay.classList.toggle('active');

            const icon = mobileMenuBtn.querySelector('i');
            if (!icon) return;

            if (sidebar.classList.contains('mobile-active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                resetMobileMenuIcon();
            }
        });

        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-active');
            mobileOverlay.classList.remove('active');
            resetMobileMenuIcon();
        });

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth > 1024) return;

                sidebar.classList.remove('mobile-active');
                mobileOverlay.classList.remove('active');
                resetMobileMenuIcon();

                const chatWindow = document.getElementById('chatWindow');
                if (chatWindow && chatWindow.classList.contains('open')) {
                    const chatCloseBtn = document.getElementById('chatCloseBtn');
                    if (chatCloseBtn) {
                        chatCloseBtn.click();
                    } else {
                        document.getElementById('chatToggleBtn')?.click();
                    }
                }
            });
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            sidebar?.classList.remove('mobile-active');
            mobileOverlay?.classList.remove('active');
            resetMobileMenuIcon();
        }
    });

    const mobileChatHistoryBtn = document.getElementById('mobileChatHistoryBtn');
    const mobileChatCloseBtn = document.getElementById('mobileChatCloseBtn');
    const chatCloseBtn = document.getElementById('chatCloseBtn');

    if (mobileChatHistoryBtn && chatWindow) {
        mobileChatHistoryBtn.addEventListener('click', () => {
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

    const handleViewportChange = () => {
        syncMobileChatViewport();
        if (chatWindow?.classList.contains('open')) {
            scrollChatToBottom();
        }
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);

    syncMobileChatViewport();
});
