document.addEventListener("DOMContentLoaded", () => {

const toggle = document.getElementById("chat-toggle");
const chatWindow = document.getElementById("chat-window");
const closeBtn = document.getElementById("close-chat");

const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("chat-input");
const messages = document.getElementById("chat-messages");


/* =========================
CHAT OPEN / CLOSE
========================= */

if (toggle) {
toggle.addEventListener("click", () => {

chatWindow.classList.toggle("active");

if (chatWindow.classList.contains("active")) {
setTimeout(() => {
if(input) input.focus();
}, 200);
}

});
}


/* =========================
CLOSE CHAT
========================= */

if (closeBtn) {
closeBtn.addEventListener("click", () => {
chatWindow.classList.remove("active");
});
}


/* =========================
SEND BUTTON
========================= */

if (sendBtn) {
sendBtn.addEventListener("click", sendMessage);
}


/* =========================
ENTER KEY SEND
========================= */

if (input) {
input.addEventListener("keypress", function (e) {

if (e.key === "Enter") {
e.preventDefault();
sendMessage();
}

});
}


/* =========================
SEND MESSAGE FUNCTION
========================= */

function sendMessage() {

if(!input || !messages) return;

const text = input.value.trim();

if (text === "") return;


/* USER MESSAGE */

const userMsg = document.createElement("div");
userMsg.className = "user-message";
userMsg.innerText = text;

messages.appendChild(userMsg);

input.value = "";

messages.scrollTop = messages.scrollHeight;


/* BOT THINKING */

setTimeout(() => {

const botThinking = document.createElement("div");
botThinking.className = "bot-message";
botThinking.innerText = "AI is thinking... 🤖";

messages.appendChild(botThinking);

messages.scrollTop = messages.scrollHeight;

}, 500);


/* BOT REPLY */

setTimeout(() => {

const botReply = document.createElement("div");
botReply.className = "bot-message";
botReply.innerText = "AI response placeholder 🤖";

messages.appendChild(botReply);

messages.scrollTop = messages.scrollHeight;

}, 1200);

}


/* =========================
SCROLL PROGRESS BAR
========================= */

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


/* =========================
SVG SCROLL LINE ANIMATION
========================= */

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