document.addEventListener("DOMContentLoaded", () => {
    // Check if we are on the login page by looking for the container
    const container = document.getElementById("container");
    if (!container) return;

    // 🔥 DEBUG: Log all social containers and their content
    console.log("=== LOGIN PAGE LOADED ===");
    const socialContainers = document.querySelectorAll(".social-container");
    console.log(`Total social containers: ${socialContainers.length}`);
    
    socialContainers.forEach((socialContainer, index) => {
        const links = socialContainer.querySelectorAll("a");
        console.log(`Social Container ${index}:`);
        console.log(`  Total links: ${links.length}`);
        links.forEach((link, linkIndex) => {
            const textContent = link.textContent.trim();
            const innerText = link.innerText;
            const innerHtml = link.innerHTML;
            console.log(`  Link ${linkIndex}:`);
            console.log(`    textContent: "${textContent}"`);
            console.log(`    innerText: "${innerText}"`);
            console.log(`    innerHTML: ${innerHtml}`);
            console.log(`    classes: ${link.className}`);
        });
    });

    const signUpButton = document.getElementById("signUp");
    const signInButton = document.getElementById("signIn");
    const signupForm = document.getElementById("signupForm");
    const loginForm = document.getElementById("loginForm");
    const guestLink = document.getElementById("guestLink");
    const googleBtns = document.querySelectorAll(".google-btn");
    const microsoftBtns = document.querySelectorAll(".microsoft-btn");
    
    console.log(`Found ${googleBtns.length} Google buttons`);

    // PANEL TOGGLE
    if (signUpButton) {
        signUpButton.addEventListener("click", () => {
            container.classList.add("right-panel-active");
        });
    }
    if (signInButton) {
        signInButton.addEventListener("click", () => {
            container.classList.remove("right-panel-active");
        });
    }

    // SIGNUP FORM
    if (signupForm) {
        signupForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const name = document.getElementById("signupName").value.trim();
            const email = document.getElementById("signupEmail").value.trim();
            const password = document.getElementById("signupPassword").value.trim();

            if (!name || !email || !password) {
                alert("Please fill all fields");
                return;
            }

            try {
                const res = await fetch("/api/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name, email, password })
                });

                const data = await res.json();

                if (data.status === "success") {
                    showNotification("Account created successfully! Please Log In.", "success");
                    container.classList.remove("right-panel-active");
                    signupForm.reset();
                } else if (data.status === "exists") {
                    showNotification("User already exists", "error");
                } else {
                    showNotification("Signup failed: " + (data.message || "Unknown error"), "error");
                }
            } catch (err) {
                console.error(err);
                showNotification("Server error during signup", "error");
            }
        });
    }

    // LOGIN FORM
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value.trim();
            const password = document.getElementById("loginPassword").value.trim();

            try {
                const res = await fetch("/api/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (data.status === "success") {
                    // 🔥 Sync Frontend Supabase Client Session
                    if (window.supabase) {
                        try {
                            const { data: authData, error: authError } = await window.supabase.auth.signInWithPassword({ 
                                email: email, 
                                password: password 
                            });
                            if (authError) console.warn("Supabase frontend auth sync error:", authError);
                        } catch (supaErr) {
                            console.warn("Supabase frontend auth catch error:", supaErr);
                        }
                    }

                    localStorage.setItem("currentUser", JSON.stringify({
                        email: email,
                        isGuest: false
                    }));
                    // Optional: show success or just redirect
                    window.location.href = data.redirect || "/dashboard";
                } else {
                    showNotification(data.message || "Invalid credentials or user not found", "error");
                }
            } catch (err) {
                console.error(err);
                showNotification("Server error during login", "error");
            }
        });
    }

    // GUEST LINK
    if (guestLink) {
        guestLink.addEventListener("click", async function (e) {
            e.preventDefault();
            try {
                const res = await fetch("/api/guest-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include"
                });

                const data = await res.json();
                if (data.status === "success") {
                    localStorage.setItem("currentUser", JSON.stringify({
                        id: null,
                        name: "Guest",
                        email: null,
                        isGuest: true
                    }));
                    window.location.href = data.redirect || "/dashboard";
                } else {
                    showNotification("Failed to continue as guest", "error");
                }
            } catch (err) {
                console.error(err);
                showNotification("Server error during guest login", "error");
            }
        });
    }

    const passwordToggles = document.querySelectorAll(".toggle-password");
    passwordToggles.forEach(toggle => {
        const targetId = toggle.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;

        toggle.addEventListener("click", () => {
            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            if (isHidden) {
                toggle.classList.remove("fa-eye");
                toggle.classList.add("fa-eye-slash");
                toggle.setAttribute("aria-label", "Hide password");
            } else {
                toggle.classList.remove("fa-eye-slash");
                toggle.classList.add("fa-eye");
                toggle.setAttribute("aria-label", "Show password");
            }
        });
    });

    googleBtns.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Google Social Login clicked");
            await initiateOAuth("google");
        });
    });

    microsoftBtns.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Microsoft Social Login clicked");
            await initiateOAuth("azure");
        });
    });

    // URL Error Detection
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("error")) {
        const errorMsg = urlParams.get("error_description") || urlParams.get("error") || "Unknown authentication error";
        console.error("Authentication error from URL:", errorMsg);
        // Delay slightly to ensure notifications are setup
        setTimeout(() => {
            showNotification(decodeURIComponent(errorMsg).replace(/\+/g, " "), "error");
        }, 500);
    }

    async function initiateOAuth(provider) {
        // Wait for Supabase to load
        let attempts = 0;
        while (!window.supabase && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        if (!window.supabase) {
            showNotification("Authentication service not loaded. Please refresh and try again.", "error");
            return;
        }

        try {
            const options = {
                redirectTo: `${window.location.origin}/login`
            };
            
            // Add email scope for azure/microsoft login
            if (provider === "azure") {
                options.scopes = "email profile openid";
            }

            const { error } = await window.supabase.auth.signInWithOAuth({
                provider: provider,
                options: options
            });

                if (error) {
                    console.error("OAuth error:", error);
                    showNotification("Google login failed: " + (error.message || "Unknown error"), "error");
                }
            } catch (err) {
                console.error("OAuth crash:", err);
                showNotification("Google login error. Please try again.", "error");
            }
        });
    });

    // FACEBOOK LOGIN
    const facebookBtns = document.querySelectorAll(".fab fa-facebook-f") || [];
    document.querySelectorAll(".social-container a").forEach(link => {
        const icon = link.querySelector("i");
        if (icon && icon.className.includes("fa-facebook")) {
            link.addEventListener("click", async (e) => {
                e.preventDefault();
                console.log("Facebook clicked");

                // Wait for Supabase to load
                let attempts = 0;
                while (!window.supabase && attempts < 10) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    attempts++;
                }

                if (!window.supabase) {
                    showNotification("Authentication service not loaded. Please refresh and try again.", "error");
                    return;
                }

                try {
                    const { error } = await window.supabase.auth.signInWithOAuth({
                        provider: "facebook",
                        options: {
                            redirectTo: `${window.location.origin}/login`
                        }
                    });

                    if (error) {
                        console.error("Facebook OAuth error:", error);
                        showNotification("Facebook login failed: " + (error.message || "Unknown error"), "error");
                    }
                } catch (err) {
                    console.error("Facebook OAuth crash:", err);
                    showNotification("Facebook login error. Please try again.", "error");
                }
            });
        }
    });

    // Handle Supabase Auth State Change
    const setupAuthStateChange = async () => {
        let attempts = 0;
        while (!window.supabase && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        if (window.supabase) {
            window.supabase.auth.onAuthStateChange(async (event, session) => {
                console.log("🔔 Auth state changed:", event, session ? "Session found" : "No session");
                
                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
                    const user = session.user;
                    const provider = session.user.app_metadata?.provider || 'unknown';
                    
                    console.log(`Auth event: ${event}, Provider: ${provider}`);
                    
                    try {
                        let endpoint = "/api/google-login";
                        if (provider === 'facebook') {
                            endpoint = "/api/facebook-login";
                        }
                        
                        const response = await fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                                id: user.id,
                                name: user.user_metadata?.full_name || user.user_metadata?.name || "User",
                                email: user.email,
                                provider: provider
                            })
                        });

                        const data = await response.json();
                        console.log("📥 Backend response:", data);

                        if (data.status === "success") {
                            localStorage.setItem("currentUser", JSON.stringify({
                                name: user.user_metadata?.full_name || user.user_metadata?.name || "User",
                                email: user.email,
                                isGuest: false
                            }));
                            console.log("🚀 Redirecting to dashboard...");
                            window.location.href = "/dashboard";
                        } else {
                            console.error("❌ Backend sync failed:", data.message);
                            showNotification("System error during login sync. Please try again.", "error");
                        }
                    } catch (err) {
                        console.error("🚨 Backend sync crash:", err);
                    }
                }
            });
        }
    };
    setupAuthStateChange();
    setupNotifications(); // Initialize custom notifications
    
    // 🔥 DEBUG: Watch for dynamic changes to social containers
    socialContainers.forEach((socialContainer, index) => {
        const observer = new MutationObserver((mutations) => {
            console.log(`⚠️ Social Container ${index} CHANGED:`, mutations);
            const links = socialContainer.querySelectorAll("a");
            console.log(`  New link count: ${links.length}`);
            links.forEach((link, linkIndex) => {
                console.log(`  Link ${linkIndex}:`, link.textContent, link.innerHTML);
            });
        });
        observer.observe(socialContainer, { 
            childList: true, 
            subtree: true, 
            characterData: true,
            attributes: true
        });
    });
});

function setupNotifications() {
    const overlay = document.getElementById('notificationOverlay');
    const closeBtn = document.getElementById('notificationClose');
    
    if (closeBtn && overlay) {
        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('show');
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('show');
            }
        });
    }
}

function showNotification(message, type = 'info') {
    const overlay = document.getElementById('notificationOverlay');
    const box = overlay.querySelector('.notification-box');
    const icon = document.getElementById('notificationIcon');
    const title = document.getElementById('notificationTitle');
    const msgElem = document.getElementById('notificationMessage');
    
    // Reset types
    box.classList.remove('success', 'error', 'info');
    box.classList.add(type);
    
    // Set content
    msgElem.textContent = message;
    
    if (type === 'success') {
        title.textContent = 'Success!';
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
    } else if (type === 'error') {
        title.textContent = 'Oops!';
        icon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
    } else {
        title.textContent = 'Notification';
        icon.innerHTML = '<i class="fas fa-info-circle"></i>';
    }
    
    // Show
    overlay.classList.add('show');
}
