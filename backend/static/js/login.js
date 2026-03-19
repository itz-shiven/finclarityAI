/* -------------------------
PANEL SWITCH
--------------------------*/

const signUpButton = document.getElementById("signUp");
const signInButton = document.getElementById("signIn");
const container = document.getElementById("container");

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


/* -------------------------
SIGN UP
--------------------------*/

const signupForm = document.getElementById("signupForm");

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
            alert("Server error");
        }
    });
}


/* -------------------------
LOGIN
--------------------------*/

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value.trim();

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (data.status === "success") {
                alert("Login successful");
                window.location.href = data.redirect || "/dashboard";
            } else {
                alert("Invalid credentials");
            }

        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    });
}


/* -------------------------
GOOGLE LOGIN (FINAL FIX)
--------------------------*/

document.addEventListener("DOMContentLoaded", () => {

    const googleBtns = document.querySelectorAll(".fa-google");

    googleBtns.forEach(btn => {
        btn.parentElement.addEventListener("click", async (e) => {

            e.preventDefault();

            console.log("Google clicked");

            if (!window.supabase) {
                alert("Supabase not loaded");
                return;
            }

            try {
                const { data, error } = await window.supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                        redirectTo: window.location.origin
                    }
                });

                if (error) {
                    console.error("OAuth error:", error);
                    alert("Google login failed");
                }

            } catch (err) {
                console.error("OAuth crash:", err);
            }
        });
    });

});


/* -------------------------
HANDLE GOOGLE CALLBACK (FINAL FIX)
--------------------------*/

window.addEventListener("load", async () => {

    if (!window.supabase) return;

    const { data: { session }, error } = await window.supabase.auth.getSession();

    if (session && session.user) {

        const user = session.user;

        console.log("User logged in:", user);

        try {
            await fetch("/api/google-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: user.user_metadata?.full_name || "User",
                    email: user.email
                })
            });
        } catch (err) {
            console.error("Backend sync error:", err);
        }

        window.location.href = "/dashboard";
    }

});


/* -------------------------
GUEST
--------------------------*/

const guestLink = document.getElementById("guestLink");

if (guestLink) {
    guestLink.addEventListener("click", async function (e) {

        e.preventDefault();

        try {
            const res = await fetch("/api/guest-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
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
            alert("Server error");
        }
    });
}