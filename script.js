const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const userInput = document.querySelector("#userInput");
const quickButtons = document.querySelectorAll("[data-question]");

const faq = [
  {
    topic: "возможности",
    keywords: ["умеешь", "можешь", "функции", "помощь", "что ты"],
    answer:
      "Я отвечаю на FAQ-вопросы, ищу смысл по ключевым словам, подсказываю темы и показываю, как устроена логика простого чат-бота.",
  },
  {
    topic: "старт",
    keywords: ["начать", "старт", "обучение", "первый", "урок"],
    answer:
      "Начни с простого: задай вопрос, посмотри ответ, а потом открой script.js и добавь свою тему в массив faq.",
  },
  {
    topic: "цена",
    keywords: ["цена", "стоимость", "сколько стоит", "оплата", "тариф"],
    answer:
      "Этот демо-бот бесплатный. Его можно менять, расширять и использовать как учебный шаблон.",
  },
  {
    topic: "telegram",
    keywords: ["телеграм", "telegram", "api", "мессенджер"],
    answer:
      "Версию для Telegram можно сделать позже: понадобится токен BotFather, серверная часть и обработка входящих сообщений через API.",
  },
  {
    topic: "браузер",
    keywords: ["браузер", "сайт", "html", "страница", "web", "веб"],
    answer:
      "Сейчас бот работает в браузере: интерфейс сделан на HTML/CSS, а ответы и логика — на JavaScript.",
  },
  {
    topic: "поддержка",
    keywords: ["поддержка", "связаться", "контакт", "помоги", "ошибка"],
    answer:
      "В учебной версии поддержки нет, но можно добавить форму обратной связи или отправку сообщений на email/в Telegram.",
  },
  {
    topic: "история",
    keywords: ["история", "сохранить", "память", "диалог", "сообщения"],
    answer:
      "Пока история живёт только на странице. Для памяти можно подключить localStorage и сохранять переписку между перезагрузками.",
  },
  {
    topic: "технологии",
    keywords: ["технологии", "код", "javascript", "js", "css"],
    answer:
      "Проект использует обычные HTML, CSS и JavaScript без фреймворков, поэтому его легко разобрать новичку.",
  },
];

const greetings = ["привет", "здравствуй", "hello", "hi", "добрый"];
const farewells = ["пока", "выход", "стоп", "до свидания", "закончить"];
const opinionTriggers = ["мнение", "думаешь", "считаешь", "позиция", "как лучше", "что выбрать"];

const opinions = [
  {
    topic: "обучение",
    keywords: ["обучение", "учиться", "курс", "проект", "практика"],
    answer:
      "Моё мнение: лучше учиться через маленькие проекты. Теория важна, но настоящий прогресс начинается, когда ты сам меняешь код и видишь результат.",
  },
  {
    topic: "javascript",
    keywords: ["javascript", "js", "фронтенд", "браузер", "сайт"],
    answer:
      "Я считаю JavaScript отличным первым языком для веба: результат сразу виден в браузере, а ошибки быстро превращаются в понятный опыт.",
  },
  {
    topic: "telegram",
    keywords: ["telegram", "телеграм", "бот", "api", "мессенджер"],
    answer:
      "Моя позиция такая: Telegram-бот — крутой следующий шаг, но сначала стоит довести браузерную версию, чтобы логика ответов была понятной и устойчивой.",
  },
  {
    topic: "ai",
    keywords: ["ии", "ai", "нейросеть", "модель", "интеллект"],
    answer:
      "Мне кажется, настоящий ИИ-бот должен не просто отвечать, а объяснять ход мысли, помнить контекст и честно говорить, когда не уверен.",
  },
];

function normalizeText(text) {
  return text.toLowerCase().replace(/ё/g, "е").trim();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(normalizeText(word)));
}

function getTopicsHint() {
  const faqTopics = faq.map((item) => item.topic);
  const opinionTopics = opinions.map((item) => `мнение: ${item.topic}`);
  return [...faqTopics, ...opinionTopics].join(", ");
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

function findOpinionAnswer(normalizedMessage) {
  if (!includesAny(normalizedMessage, opinionTriggers)) {
    return null;
  }

  const bestOpinion = getBestScoredItem(opinions, normalizedMessage);

  if (bestOpinion) {
    return bestOpinion.answer;
  }

  return "Моё мнение: для учебного бота главное — не казаться всезнающим, а честно объяснять логику и помогать двигаться дальше.";
}

function findBestAnswer(message) {
  const normalizedMessage = normalizeText(message);

  if (includesAny(normalizedMessage, greetings)) {
    return "Привет! Я браузерный FAQ-бот с характером. Спроси про старт, цену, Telegram, технологии, историю, поддержку или моё мнение.";
  }

  if (includesAny(normalizedMessage, farewells)) {
    return "Пока! Если захочешь продолжить, просто напиши новый вопрос.";
  }

  const opinionAnswer = findOpinionAnswer(normalizedMessage);

  if (opinionAnswer) {
    return opinionAnswer;
  }

  const bestMatch = getBestScoredItem(faq, normalizedMessage);

  if (bestMatch) {
    return bestMatch.answer;
  }

  return `Я пока не знаю точный ответ. Попробуй спросить про темы: ${getTopicsHint()}.`;
}

function addMessage(text, sender) {
  const message = document.createElement("div");
  message.className = `message ${sender}`;
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage(text) {
  const cleanText = text.trim();

  if (!cleanText) {
    return;
  }

  addMessage(cleanText, "user");
  userInput.value = "";

  window.setTimeout(() => {
    addMessage(findBestAnswer(cleanText), "bot");
  }, 250);
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(userInput.value);
});

quickButtons.forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.question));
});

addMessage(
  "Привет! Я умный FAQ-бот в браузере. Задай вопрос, нажми быструю кнопку или спроси моё мнение.",
  "bot",
);
