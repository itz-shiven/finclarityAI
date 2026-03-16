document.addEventListener("DOMContentLoaded", () => {

const toggle = document.getElementById("chat-toggle");
const chatWindow = document.getElementById("chat-window");
const closeBtn = document.getElementById("close-chat");

const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("chat-input");
const messages = document.getElementById("chat-messages");


/* OPEN / CLOSE CHAT */

toggle.addEventListener("click", () => {

    chatWindow.classList.toggle("active");

    if(chatWindow.classList.contains("active")){
        setTimeout(() => {
            input.focus();
        },200);
    }

});


/* CLOSE BUTTON */

closeBtn.addEventListener("click", () => {
    chatWindow.classList.remove("active");
});


/* SEND BUTTON */

sendBtn.addEventListener("click", sendMessage);


/* ENTER KEY SEND */

input.addEventListener("keypress", function(e){

    if(e.key === "Enter"){
        sendMessage();
    }

});


/* SEND MESSAGE FUNCTION */

function sendMessage(){

    const text = input.value.trim();

    if(text === "") return;


    /* USER MESSAGE */

    const userMsg = document.createElement("div");

    userMsg.className = "user-message";

    userMsg.innerText = text;

    messages.appendChild(userMsg);


    input.value = "";

    messages.scrollTop = messages.scrollHeight;


    /* BOT THINKING */

    setTimeout(()=>{

        const botMsg = document.createElement("div");

        botMsg.className = "bot-message";

        botMsg.innerText = "AI is thinking... 🤖";

        messages.appendChild(botMsg);

        messages.scrollTop = messages.scrollHeight;

    },600);


    /* BOT REPLY */

    setTimeout(()=>{

        const botReply = document.createElement("div");

        botReply.className = "bot-message";

        botReply.innerText = "AI response placeholder 🤖";

        messages.appendChild(botReply);

        messages.scrollTop = messages.scrollHeight;

    },1400);

}


/* SCROLL PROGRESS BAR */

window.addEventListener("scroll", () => {

    const scrollTop = document.documentElement.scrollTop;

    const scrollHeight =
    document.documentElement.scrollHeight -
    document.documentElement.clientHeight;

    const progress = (scrollTop / scrollHeight) * 100;

    const bar = document.querySelector(".scroll-progress");

    if(bar){
        bar.style.width = progress + "%";
    }

});

});