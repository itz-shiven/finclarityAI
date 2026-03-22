document.addEventListener("DOMContentLoaded", () => {

    const toggle = document.getElementById("chat-toggle");
    const chatWindow = document.getElementById("chat-window");
    const closeBtn = document.getElementById("close-chat");

    const sendBtn = document.getElementById("send-btn");
    const input = document.getElementById("chat-input");
    const messages = document.getElementById("chat-messages");

    if (toggle) {
        toggle.addEventListener("click", () => {

            chatWindow.classList.toggle("active");

            if (chatWindow.classList.contains("active")) {
                setTimeout(() => {
                    if (input) input.focus();
                }, 200);
            }

        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            chatWindow.classList.remove("active");
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener("click", sendMessage);
    }

    if (input) {
        input.addEventListener("keypress", function (e) {

            if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
            }

        });
    }

    function sendMessage() {

        if (window.currentUserData && window.currentUserData.isGuest) {
            alert("Please sign in to use the AI Assistant");
            window.location.href = '/login';
            return;
        }

        if (!input || !messages) return;

        const text = input.value.trim();

        if (text === "") return;

        const userMsg = document.createElement("div");
        userMsg.className = "user-message";
        userMsg.innerText = text;

        messages.appendChild(userMsg);

        input.value = "";

        messages.scrollTop = messages.scrollHeight;

        const botThinking = document.createElement("div");
        botThinking.className = "bot-message";
        botThinking.innerText = "AI is thinking... 🤖";

        messages.appendChild(botThinking);

        messages.scrollTop = messages.scrollHeight;


        /* BUILD CONVERSATION HISTORY */
        const history = [];
        const messageElements = messages.querySelectorAll(".user-message, .bot-message");
        
        for (let i = 0; i < messageElements.length - 2; i++) {
            const element = messageElements[i];
            if (element.classList.contains("user-message")) {
                history.push({
                    role: "user",
                    content: element.innerText
                });
            } else if (element.classList.contains("bot-message")) {
                history.push({
                    role: "assistant",
                    content: element.innerText
                });
            }
        }

        /* GET USER MEMORY */
        let userData = [];
        try {
            const savedData = localStorage.getItem("userMemory");
            userData = savedData ? JSON.parse(savedData) : [];
        } catch (e) {
            userData = [];
        }

        fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: text,
                history: history,
                user_memory: userData
            })
        })
        .then(response => response.json())
        .then(data => {
            botThinking.remove();
            
            const botReply = document.createElement("div");
            botReply.className = "bot-message";
            botReply.innerText = data.reply || "Sorry, I encountered an error.";

            messages.appendChild(botReply);

            messages.scrollTop = messages.scrollHeight;
        })
        .catch(error => {
            console.error("Error:", error);
            botThinking.innerText = "Error connecting to server. Please try again.";
        });

    }

    window.addEventListener("scroll", () => {

        const scrollTop = document.documentElement.scrollTop;

        const scrollHeight =
            document.documentElement.scrollHeight -
            document.documentElement.clientHeight;

        const progress = (scrollTop / scrollHeight) * 100;

        const bar = document.querySelector(".scroll-progress");

        if (bar) {
            bar.style.width = progress + "%";
        }

    });

    const path = document.getElementById("line");

    if (path) {

        const length = path.getTotalLength();

        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;

        window.addEventListener("scroll", () => {

            const scroll = window.scrollY;

            const height =
                document.body.scrollHeight -
                window.innerHeight;

            const progress = scroll / height;

            const draw = length * progress;

            path.style.strokeDashoffset = length - draw;

        });

    }

});