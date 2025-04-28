const Container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// API Setup
const API_KEY = " Fill your own API Key"; // API key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

let typingInterval, controller;
const chatHistory = []; // Array to store chat history so that the bot can remember the conversation
let userData = { message: "", file: {} };

// Function to create a message element
const createMsgElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
}

// Modify the scrollToBottom function
let userHasScrolled = false;
let lastScrollTop = 0;
const scrollToBottom = () => {
    // Only auto-scroll if user hasn't manually scrolled up
    if (!userHasScrolled) {
      Container.scrollTo({ top: Container.scrollHeight, behavior: "smooth" });
    }
  };

  Container.addEventListener("scroll", () => {
    const isScrollingUp = Container.scrollTop < lastScrollTop;
    const isAtBottom = Container.scrollHeight - Container.scrollTop - Container.clientHeight < 50;
    
    // If user scrolls up, stop auto-scrolling
    if (isScrollingUp) {
      userHasScrolled = true;
    }
    
    // If user manually scrolls back to bottom, resume auto-scrolling
    if (isAtBottom) {
      userHasScrolled = false;
    }
    
    lastScrollTop = Container.scrollTop;
  });

//Simulate typing effect for the bot response
const typingEffect = (text, textElement, botMsgDiv) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;

    //Set an interval to type each word
    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++]; // Add a space before the word if it's not the first word
            scrollToBottom(); // Scroll to the bottom of the chat container
        } else {
            clearInterval(typingInterval);
            botMsgDiv.classList.remove("loading"); // Remove loading class after typing effect is done
            document.body.classList.remove("bot-responding");
        }
    }, 40); // Typing speed in milliseconds
}

// Function to generate a bot response
const generateResponse = async (botMsgDiv) => {
    const textElement = botMsgDiv.querySelector(".message-text");
    controller = new AbortController();

    // Add the user message and file data to the chat history
    chatHistory.push({
        role: "user",
        parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])]
    });

    try {
        // send the chat history to the API to get a response
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory }),
            signal: controller.signal // Pass the abort signal to the fetch request
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        // Process the response text and display it in the chat container with typing effect
        const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim(); // Extract the response text from the API response
        typingEffect(responseText, textElement, botMsgDiv); // Call the typing effect function to display the response text
        chatHistory.push({
            role: "model", parts: [{ text: responseText }] });  // Add the bot response to the chat history
    } catch (error) {
        textElement.style.color = "#d62929"; // Change text color to red for error messages
        textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message; 
        botMsgDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
    } finally {
        userData.file = {};
    }
}

// Handle the form submission
const handleFormSubmit = (e) => {
    const resetScrolling = () => {
        userHasScrolled = false;
        scrollToBottom();
      };
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    if (!userMessage || document.body.classList.contains("bot-responding")) return;

    promptInput.value = ""; // Clear the prompt input once the message is added 
    userData.message = userMessage; // Store the user message in the userData object
    document.body.classList.add("bot-responding", "chats-active"); // Add a class to the body to indicate that the bot is responding
    fileUploadWrapper.classList.remove("active", "Img-attached", "file-attached"); // Hide the file upload wrapper

    // Generate user message HTML and append it to the chat container
    const userMsgHTML = `<p class="message-text"></p> ${userData.file.data ? (userData.file.isImage ? `<img src="data: ${userData.file.mime_type};base64,${userData.file.data}" class="image-attachment" />` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}`;

    const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
    userMsgDiv.querySelector(".message-text").textContent = userMessage;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom(); // Scroll to the bottom of the chat container

    setTimeout(() => {
        // Simulate a bot response after a 600ms delay
        const botMsgHTML = `<img src="gemini.svg" class="avatar"><p class="message-text">Wait a moment...</p>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        generateResponse(botMsgDiv);
    }, 600);
}

// Handle file input change (when a file is selected)
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return; // If no file is selected, do nothing

    const isImage = file.type.startsWith("image/"); // Check if the file is an image
    const reader = new FileReader; // Read the file as text
    reader.readAsDataURL(file); // Read the file as text

    reader.onload = (e) => {
        fileInput.value = ""; // Clear the file input after reading the file
        const base64String = e.target.result.split(",")[1]; // Get the base64 string from the file data Url as Gemini only receives the base64 string of file
        fileUploadWrapper.querySelector(".file-preview").src = e.target.result; // Set the file preview source to the file data URL
        fileUploadWrapper.classList.add("active", isImage ? "Img-attached" : "file-attached"); // Show the file upload wrapper

        userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage }; // Store the file name and type in the userData object
    }
});

// Cancel file upload button
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
    userData.file = {}; // Clearing file data once the upload is canceled or the response is generated
    fileUploadWrapper.classList.remove("active", "Img-attached", "file-attached"); // Hide the file upload wrapper
});

// Stop ongoing bot response
document.querySelector("#stop-prompt-btn").addEventListener("click", () => {
    userData.file = {};
    controller?.abort();
    clearInterval(typingInterval); // Clear the typing interval
    chatsContainer.querySelector(".bot-message.loading")?.classList.remove("loading"); 
    document.body.classList.remove("bot-responding"); 
});

// Delete all chats button
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    chatHistory.length = 0; // Clear the chat history array
    chatsContainer.innerHTML = ""; // Clear the chat container
    document.body.classList.remove("chats-active", "bot-responding"); // Remove the classes
});

// Add event listener to the suggestion items
document.querySelectorAll(".suggestions-item").forEach(item => {
    item.addEventListener("click", () => {
        promptInput.value = item.querySelector(".text").textContent;
        promptForm.dispatchEvent(new Event("submit")); 
    });
});

// Show/hide controls for moving on prompt input focus
document.addEventListener("click", ({ target }) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-prompt-btn"));
    wrapper.classList.toggle("hide-controls", shouldHide);
});

// Theme toggle button
themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme"); 
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode"); // Store the theme preference in local storage
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode"; 
});

// Set the initial theme based on local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode"; 
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode"; 

// Add input validation for showing send button
promptInput.addEventListener("input", () => {
    const sendBtn = document.querySelector("#send-prompt-btn");
    if (promptInput.value.trim() !== "") {
        sendBtn.style.display = "block";
    } else {
        sendBtn.style.display = "none";
    }
});

// Event listeners
promptForm.addEventListener("submit", handleFormSubmit);
document.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click()); // Open file input when the button is clicked
document.querySelector("#send-prompt-btn").addEventListener("click", () => promptForm.dispatchEvent(new Event("submit"))); // Submit form when send button is clicked