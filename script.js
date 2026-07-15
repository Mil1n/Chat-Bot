const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const userInput = document.querySelector("#userInput");
const quickButtons = document.querySelectorAll("[data-question]");
const personaSelect = document.querySelector("#personaSelect");
const themeToggle = document.querySelector("#themeToggle");
const clearChat = document.querySelector("#clearChat");

const storageKeys = {
  messages: "chatBot.messages",
  theme: "chatBot.theme",
  persona: "chatBot.persona",
  ratings: "chatBot.ratings",
};

const personaPrefixes = {
  friendly: "😊 По-дружески: ",
  expert: "🧠 Экспертно: ",
  strict: "📌 Коротко и строго: ",
  funny: "😄 Моё ботское мнение: ",
};

const greetings = ["привет", "здравствуй", "hello", "hi", "добрый"];
const farewells = ["пока", "выход", "стоп", "до свидания", "закончить"];
const opinionTriggers = ["мнение", "думаешь", "считаешь", "позиция", "как лучше", "что выбрать"];

let faq = [];
let opinions = [];
let knowledge = [];
let messages = [];
let ratings = loadFromStorage(storageKeys.ratings, []);

function loadFromStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(text) {
  return text.toLowerCase().replace(/ё/g, "е").trim();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(normalizeText(word)));
}

function getTopicsHint() {
  const faqTopics = faq.map((item) => item.topic);
  const opinionTopics = opinions.map((item) => `мнение: ${item.topic}`);
  return [...faqTopics, ...opinionTopics, "RAG", "AI API"].join(", ");
}

function getBestScoredItem(items, normalizedMessage) {
  let bestMatch = null;
  let bestScore = 0;

  items.forEach((item) => {
    const score = item.keywords.reduce((total, keyword) => {
      return normalizedMessage.includes(normalizeText(keyword)) ? total + 1 : total;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  });

  return bestMatch;
}

function withPersona(text) {
  return `${personaPrefixes[personaSelect.value]}${text}`;
}

function findOpinionAnswer(normalizedMessage) {
  if (!includesAny(normalizedMessage, opinionTriggers)) {
    return null;
  }

  const bestOpinion = getBestScoredItem(opinions, normalizedMessage);
  const answer = bestOpinion
    ? bestOpinion.answer
    : "для учебного бота главное — не казаться всезнающим, а честно объяснять логику и помогать двигаться дальше.";

  return withPersona(answer);
}

function findKnowledgeAnswer(normalizedMessage) {
  const bestDocument = getBestScoredItem(knowledge, normalizedMessage);

  if (!bestDocument) {
    return null;
  }

  return `📚 Нашёл в базе знаний «${bestDocument.title}»: ${bestDocument.content}`;
}

async function askAiBackend(message) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        persona: personaSelect.value,
        history: messages.slice(-8),
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.answer || null;
  } catch {
    return null;
  }
}

function findLocalAnswer(message) {
  const normalizedMessage = normalizeText(message);

  if (includesAny(normalizedMessage, greetings)) {
    return withPersona("привет! Спроси про старт, цену, Telegram, технологии, RAG, AI API или моё мнение.");
  }

  if (includesAny(normalizedMessage, farewells)) {
    return withPersona("пока! Если захочешь продолжить, просто напиши новый вопрос.");
  }

  const opinionAnswer = findOpinionAnswer(normalizedMessage);

  if (opinionAnswer) {
    return opinionAnswer;
  }

  const knowledgeAnswer = findKnowledgeAnswer(normalizedMessage);

  if (knowledgeAnswer) {
    return knowledgeAnswer;
  }

  const bestMatch = getBestScoredItem(faq, normalizedMessage);

  if (bestMatch) {
    return bestMatch.answer;
  }

  return `Я пока не знаю точный ответ. Попробуй спросить про темы: ${getTopicsHint()}.`;
}

async function getBotAnswer(message) {
  const aiAnswer = await askAiBackend(message);
  return aiAnswer || findLocalAnswer(message);
}

function renderMessages() {
  chatMessages.innerHTML = "";
  messages.forEach((message) => addMessageToDom(message));
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessageToDom(message) {
  const messageElement = document.createElement("div");
  messageElement.className = `message ${message.sender}`;
  messageElement.textContent = message.text;

  if (message.sender === "bot") {
    const rating = document.createElement("div");
    rating.className = "rating";
    rating.innerHTML = `
      <button type="button" data-rating="up" data-id="${message.id}">👍</button>
      <button type="button" data-rating="down" data-id="${message.id}">👎</button>
    `;
    messageElement.append(rating);
  }

  chatMessages.append(messageElement);
}

function addMessage(text, sender) {
  const message = {
    id: crypto.randomUUID(),
    text,
    sender,
    createdAt: new Date().toISOString(),
  };

  messages.push(message);
  saveToStorage(storageKeys.messages, messages);
  addMessageToDom(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

async function sendMessage(text) {
  const cleanText = text.trim();

  if (!cleanText) {
    return;
  }

  addMessage(cleanText, "user");
  userInput.value = "";

  const thinkingMessage = addMessage("Печатаю ответ…", "bot");
  const answer = await getBotAnswer(cleanText);
  thinkingMessage.text = answer;
  saveToStorage(storageKeys.messages, messages);
  renderMessages();
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "☀️ Светлая тема" : "🌙 Тёмная тема";
  saveToStorage(storageKeys.theme, theme);
}

async function loadData() {
  const [faqResponse, knowledgeResponse] = await Promise.all([
    fetch("faq.json"),
    fetch("knowledge.json"),
  ]);
  const faqData = await faqResponse.json();
  faq = faqData.faq;
  opinions = faqData.opinions;
  knowledge = await knowledgeResponse.json();
}

function boot() {
  const savedTheme = localStorage.getItem(storageKeys.theme) || "light";
  const savedPersona = localStorage.getItem(storageKeys.persona) || "friendly";
  messages = loadFromStorage(storageKeys.messages, []);

  personaSelect.value = savedPersona;
  setTheme(savedTheme);

  if (messages.length === 0) {
    addMessage("Привет! Я умный бот в браузере: помню чат, меняю характер, читаю JSON и могу работать с AI backend.", "bot");
  } else {
    renderMessages();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(userInput.value);
});

quickButtons.forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.question));
});

personaSelect.addEventListener("change", () => {
  saveToStorage(storageKeys.persona, personaSelect.value);
  addMessage(`Характер переключён: ${personaSelect.selectedOptions[0].textContent}.`, "bot");
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
});

clearChat.addEventListener("click", () => {
  messages = [];
  saveToStorage(storageKeys.messages, messages);
  renderMessages();
  addMessage("История очищена. Начинаем заново!", "bot");
});

chatMessages.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rating]");

  if (!button) {
    return;
  }

  ratings.push({
    messageId: button.dataset.id,
    rating: button.dataset.rating,
    createdAt: new Date().toISOString(),
  });
  saveToStorage(storageKeys.ratings, ratings);
  button.closest(".rating").textContent = "Спасибо за оценку!";
});

loadData()
  .then(boot)
  .catch(() => {
    faq = [];
    opinions = [];
    knowledge = [];
    boot();
    addMessage("Не смог загрузить JSON-базу. Запусти проект через локальный сервер: python3 -m http.server 8000.", "bot");
  });
