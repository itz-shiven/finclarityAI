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
SIGN UP (REGISTER USER)
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
                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })

            });

            const data = await res.json();

            if (data.status === "success") {

                alert("Account created successfully!");

                /* switch to login panel */
                container.classList.remove("right-panel-active");

                signupForm.reset();

            } else if (data.status === "exists") {

                alert("User already exists");

            } else {

                alert("Signup failed");

            }

        } catch (err) {

            console.error("Signup error:", err);
            alert("Server error");

        }

    });

}


/* -------------------------
LOGIN USER
--------------------------*/

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value.trim();

        if (!email || !password) {
            alert("Enter email and password");
            return;
        }

        try {

            const res = await fetch("/api/login", {

                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email,
                    password: password
                })

            });

            const data = await res.json();

            if (data.status === "success") {

                alert("Login successful");

                /* ✅ Store user data in localStorage */
                if (data.user) {
                    localStorage.setItem("currentUser", JSON.stringify(data.user));
                }

                /* redirect to dashboard */
                window.location.href = data.redirect || "/dashboard";

            } else {

                alert("Invalid credentials");

            }

        } catch (err) {

            console.error("Login error:", err);
            alert("Server error");

        }

    });

}

/* -------------------------
CONTINUE AS GUEST
--------------------------*/

const guestLink = document.getElementById("guestLink");

if (guestLink) {

    guestLink.addEventListener("click", function (e) {

        e.preventDefault();

        console.log("Continuing as guest");

        /* ✅ Store guest user in localStorage */
        localStorage.setItem("currentUser", JSON.stringify({
            id: null,
            name: "Guest",
            email: null,
            isGuest: true
        }));

        /* Redirect to dashboard */
        window.location.href = "/dashboard";

    });

}