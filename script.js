const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const userInput = document.querySelector("#userInput");
const quickButtons = document.querySelectorAll("[data-question]");
const personaSelect = document.querySelector("#personaSelect");
const themeToggle = document.querySelector("#themeToggle");
const clearChat = document.querySelector("#clearChat");
const userName = document.querySelector("#userName");
const debateMode = document.querySelector("#debateMode");
const customPersona = document.querySelector("#customPersona");
const savePersona = document.querySelector("#savePersona");
const faqAdminForm = document.querySelector("#faqAdminForm");
const faqTopic = document.querySelector("#faqTopic");
const faqKeywords = document.querySelector("#faqKeywords");
const faqAnswer = document.querySelector("#faqAnswer");
const statsPanel = document.querySelector("#statsPanel");
const knowledgeUpload = document.querySelector("#knowledgeUpload");
const voiceInput = document.querySelector("#voiceInput");
const exportChat = document.querySelector("#exportChat");

const storageKeys = {
  messages: "chatBot.messages",
  theme: "chatBot.theme",
  persona: "chatBot.persona",
  ratings: "chatBot.ratings",
  customFaq: "chatBot.customFaq",
  customKnowledge: "chatBot.customKnowledge",
  customPersona: "chatBot.customPersona",
  userProfile: "chatBot.userProfile",
  debate: "chatBot.debate",
};

const personaPrefixes = {
  friendly: "😊 По-дружески: ",
  expert: "🧠 Экспертно: ",
  strict: "📌 Коротко и строго: ",
  funny: "😄 Моё ботское мнение: ",
  custom: "🎭 По моей личности: ",
};

const greetings = ["привет", "здравствуй", "hello", "hi", "добрый"];
const farewells = ["пока", "выход", "стоп", "до свидания", "закончить"];
const opinionTriggers = ["мнение", "думаешь", "считаешь", "позиция", "как лучше", "что выбрать"];
const debateTriggers = ["поспорь", "спор", "не согласен", "дискуссия", "возрази"];

let faq = [];
let opinions = [];
let knowledge = [];
let messages = [];
let ratings = loadFromStorage(storageKeys.ratings, []);
let userProfile = loadFromStorage(storageKeys.userProfile, { name: "" });

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

function keywordize(text) {
  return normalizeText(text)
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length > 2);
}

function getTopicsHint() {
  const faqTopics = faq.map((item) => item.topic);
  const opinionTopics = opinions.map((item) => `мнение: ${item.topic}`);
  const knowledgeTopics = knowledge.map((item) => `источник: ${item.title}`);
  return [...faqTopics, ...opinionTopics, ...knowledgeTopics, "RAG", "AI API"].join(", ");
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

  return { item: bestMatch, score: bestScore };
}

function getConfidence(score) {
  if (score >= 2) {
    return "уверен";
  }

  if (score === 1) {
    return "примерно уверен";
  }

  return "лучше проверить";
}

function withPersona(text) {
  const namePart = userProfile.name ? `${userProfile.name}, ` : "";
  const customNote = personaSelect.value === "custom" && customPersona.value.trim()
    ? ` (${customPersona.value.trim()})`
    : "";
  return `${personaPrefixes[personaSelect.value]}${namePart}${text}${customNote}`;
}

function addDebateFrame(answer) {
  if (!debateMode.checked) {
    return answer;
  }

  return `${answer}\n\n🗣️ Альтернативная точка зрения: можно спорить с этим ответом, если цель — не скорость, а глубина и качество решения.`;
}

function formatAnswer(answer, confidence, source) {
  const sourceLine = source ? `\nИсточник: ${source}` : "";
  return `${addDebateFrame(answer)}\n\nУверенность: ${confidence}.${sourceLine}`;
}

function findOpinionAnswer(normalizedMessage) {
  if (!includesAny(normalizedMessage, opinionTriggers) && !includesAny(normalizedMessage, debateTriggers)) {
    return null;
  }

  const { item, score } = getBestScoredItem(opinions, normalizedMessage);
  const answer = item
    ? item.answer
    : "для учебного бота главное — не казаться всезнающим, а честно объяснять логику и помогать двигаться дальше.";

  return formatAnswer(withPersona(answer), getConfidence(score), item ? `faq.json / opinions / ${item.topic}` : null);
}

function findKnowledgeAnswer(normalizedMessage) {
  const { item, score } = getBestScoredItem(knowledge, normalizedMessage);

  if (!item) {
    return null;
  }

  return formatAnswer(`📚 Нашёл в базе знаний «${item.title}»: ${item.content}`, getConfidence(score), item.source || item.title);
}

async function askAiBackend(message) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        persona: personaSelect.value,
        customPersona: customPersona.value,
        debate: debateMode.checked,
        userProfile,
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
    return formatAnswer(withPersona("привет! Спроси про старт, цену, Telegram, технологии, RAG, AI API или моё мнение."), "уверен");
  }

  if (includesAny(normalizedMessage, farewells)) {
    return formatAnswer(withPersona("пока! Если захочешь продолжить, просто напиши новый вопрос."), "уверен");
  }

  const opinionAnswer = findOpinionAnswer(normalizedMessage);

  if (opinionAnswer) {
    return opinionAnswer;
  }

  const knowledgeAnswer = findKnowledgeAnswer(normalizedMessage);

  if (knowledgeAnswer) {
    return knowledgeAnswer;
  }

  const { item, score } = getBestScoredItem(faq, normalizedMessage);

  if (item) {
    return formatAnswer(item.answer, getConfidence(score), `faq.json / ${item.topic}`);
  }

  return formatAnswer(`Я пока не знаю точный ответ. Попробуй спросить про темы: ${getTopicsHint()}.`, "лучше проверить");
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

function typeBotAnswer(message, answer) {
  message.text = "";
  const characters = [...answer];
  let index = 0;

  const timer = window.setInterval(() => {
    message.text += characters[index] || "";
    index += 1;
    saveToStorage(storageKeys.messages, messages);
    renderMessages();

    if (index >= characters.length) {
      window.clearInterval(timer);
    }
  }, 12);
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
  typeBotAnswer(thinkingMessage, answer);
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "☀️ Светлая тема" : "🌙 Тёмная тема";
  saveToStorage(storageKeys.theme, theme);
}

function updateStats() {
  const up = ratings.filter((item) => item.rating === "up").length;
  const down = ratings.filter((item) => item.rating === "down").length;
  const weakTopics = down > up ? "Нужно улучшить ответы с плохими оценками." : "Критичных слабых мест пока не видно.";
  statsPanel.textContent = `👍 ${up} / 👎 ${down}. ${weakTopics}`;
}

function exportDialog() {
  const content = messages
    .map((message) => `[${message.createdAt}] ${message.sender === "user" ? "Пользователь" : "Бот"}: ${message.text}`)
    .join("\n\n");
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "chat-history.md";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadData() {
  const [faqResponse, knowledgeResponse] = await Promise.all([
    fetch("faq.json"),
    fetch("knowledge.json"),
  ]);
  const faqData = await faqResponse.json();
  faq = [...faqData.faq, ...loadFromStorage(storageKeys.customFaq, [])];
  opinions = faqData.opinions;
  knowledge = [...(await knowledgeResponse.json()), ...loadFromStorage(storageKeys.customKnowledge, [])];
}

function boot() {
  const savedTheme = localStorage.getItem(storageKeys.theme) || "light";
  const savedPersona = localStorage.getItem(storageKeys.persona) || "friendly";
  const savedCustomPersona = localStorage.getItem(storageKeys.customPersona) || "";
  const savedDebate = localStorage.getItem(storageKeys.debate) === "true";
  messages = loadFromStorage(storageKeys.messages, []);

  userName.value = userProfile.name;
  personaSelect.value = savedPersona;
  customPersona.value = savedCustomPersona;
  debateMode.checked = savedDebate;
  setTheme(savedTheme);
  updateStats();

  if (messages.length === 0) {
    addMessage("Привет! Я умный бот: помню профиль, редактирую FAQ, цитирую источники, спорю и экспортирую чат.", "bot");
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

userName.addEventListener("change", () => {
  userProfile.name = userName.value.trim();
  saveToStorage(storageKeys.userProfile, userProfile);
  addMessage(userProfile.name ? `Запомнил имя: ${userProfile.name}.` : "Имя очищено.", "bot");
});

savePersona.addEventListener("click", () => {
  saveToStorage(storageKeys.customPersona, customPersona.value.trim());
  personaSelect.value = "custom";
  saveToStorage(storageKeys.persona, "custom");
  addMessage("Сохранил новую личность и включил характер «Свой».", "bot");
});

debateMode.addEventListener("change", () => {
  saveToStorage(storageKeys.debate, String(debateMode.checked));
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

faqAdminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const newItem = {
    topic: faqTopic.value.trim(),
    keywords: faqKeywords.value.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    answer: faqAnswer.value.trim(),
  };
  const customFaq = [...loadFromStorage(storageKeys.customFaq, []), newItem];
  saveToStorage(storageKeys.customFaq, customFaq);
  faq.push(newItem);
  faqAdminForm.reset();
  addMessage(`Добавил FAQ-тему «${newItem.topic}».`, "bot");
});

knowledgeUpload.addEventListener("change", async () => {
  const uploaded = [];

  for (const file of knowledgeUpload.files) {
    const content = await file.text();
    uploaded.push({
      title: file.name,
      source: file.name,
      keywords: keywordize(`${file.name} ${content}`).slice(0, 40),
      content: content.slice(0, 700),
    });
  }

  const customKnowledge = [...loadFromStorage(storageKeys.customKnowledge, []), ...uploaded];
  saveToStorage(storageKeys.customKnowledge, customKnowledge);
  knowledge.push(...uploaded);
  addMessage(`Загрузил файлов в базу знаний: ${uploaded.length}.`, "bot");
});

voiceInput.addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addMessage("Голосовой ввод не поддерживается в этом браузере.", "bot");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "ru-RU";
  recognition.start();
  recognition.onresult = (event) => {
    userInput.value = event.results[0][0].transcript;
    sendMessage(userInput.value);
  };
});

exportChat.addEventListener("click", exportDialog);

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
  updateStats();
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
