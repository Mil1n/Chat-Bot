import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = process.env.PORT || 8000;
const publicDir = process.cwd();
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function handleAiChat(request, response) {
  const { message, persona, customPersona, debate, userProfile, history } = await readRequestBody(request);

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, {
      answer:
        "AI backend запущен, но OPENAI_API_KEY не задан. Пока отвечаю локальной логикой в браузере.",
    });
    return;
  }

  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            `Ты браузерный учебный чат-бот с характером '${persona}'. ` +
            `Имя пользователя: ${userProfile?.name || "неизвестно"}. ` +
            `Своя персона: ${customPersona || "не задана"}. ` +
            `Режим дискуссии: ${debate ? "включён" : "выключен"}. ` +
            "Имей аккуратное мнение, объясняй просто, не выдумывай факты, признавай неопределённость и указывай уровень уверенности.",
        },
        ...history.map((item) => ({
          role: item.sender === "user" ? "user" : "assistant",
          content: item.text,
        })),
        { role: "user", content: message },
      ],
    }),
  });

  if (!aiResponse.ok) {
    sendJson(response, aiResponse.status, { answer: "AI API временно не ответил. Используй локальный режим." });
    return;
  }

  const data = await aiResponse.json();
  sendJson(response, 200, { answer: data.output_text });
}

async function serveStatic(request, response) {
  const requestedPath = new URL(request.url, `http://${request.headers.host}`).pathname;
  const safePath = normalize(requestedPath === "/" ? "/index.html" : requestedPath).replace(/^\.\.(\/|\\|$)/, "");
  const filePath = join(publicDir, safePath);
  const file = await readFile(filePath);
  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "text/plain; charset=utf-8" });
  response.end(file);
}

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/chat") {
      await handleAiChat(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 404, { error: "Not found", details: error.message });
  }
}).listen(port, () => {
  console.log(`Chat-Bot server: http://localhost:${port}`);
});
