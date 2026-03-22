document.addEventListener("DOMContentLoaded", () => {
    // Check if we are on the login page by looking for the container
    const container = document.getElementById("container");
    if (!container) return;

    const signUpButton = document.getElementById("signUp");
    const signInButton = document.getElementById("signIn");
    const signupForm = document.getElementById("signupForm");
    const loginForm = document.getElementById("loginForm");
    const guestLink = document.getElementById("guestLink");
    const googleBtns = document.querySelectorAll(".fa-google");

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
                    alert("Account created successfully!");
                    container.classList.remove("right-panel-active");
                    signupForm.reset();
                } else if (data.status === "exists") {
                    alert("User already exists");
                } else {
                    alert("Signup failed");
                }
            } catch (err) {
                console.error(err);
                alert("Server error during signup");
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
                    localStorage.setItem("currentUser", JSON.stringify({
                        email: email,
                        isGuest: false
                    }));
                    alert("Login successful");
                    window.location.href = data.redirect || "/dashboard";
                } else {
                    alert("Invalid credentials or user not found");
                }
            } catch (err) {
                console.error(err);
                alert("Server error during login");
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
                    alert("Failed to continue as guest");
                }
            } catch (err) {
                console.error(err);
                alert("Server error during guest login");
            }
        });
    }

    // GOOGLE LOGIN
    googleBtns.forEach(btn => {
        btn.parentElement.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Google clicked");

            // Wait for Supabase to load
            let attempts = 0;
            while (!window.supabase && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                attempts++;
            }

            if (!window.supabase) {
                alert("Authentication service not loaded. Please refresh and try again.");
                return;
            }

            try {
                const { error } = await window.supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                        redirectTo: `${window.location.origin}/login`
                    }
                });

                if (error) {
                    console.error("OAuth error:", error);
                    alert("Google login failed: " + (error.message || "Unknown error"));
                }
            } catch (err) {
                console.error("OAuth crash:", err);
                alert("Google login error. Please try again.");
            }
        });
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
                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
                    const user = session.user;
                    try {
                        const response = await fetch("/api/google-login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                                name: user.user_metadata?.full_name || "User",
                                email: user.email
                            })
                        });

                        const data = await response.json();
                        if (data.status === "success") {
                            localStorage.setItem("currentUser", JSON.stringify({
                                name: user.user_metadata?.full_name || "User",
                                email: user.email,
                                isGuest: false
                            }));
                            window.location.href = "/dashboard";
                        }
                    } catch (err) {
                        console.error("Backend sync error:", err);
                    }
                }
            });
        }
    };
    setupAuthStateChange();
});