const API_KEY_STORAGE = "mealtracker.apikey.v1";
const CHAT_HISTORY_STORAGE = "mealtracker.chat.v1";
const MODEL = "claude-opus-4-7";
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are a nutrition estimation assistant inside a personal meal tracker app called "Meal Tracker". The user logs meals to track their daily nutrition.

Your job: when the user describes food, estimate calories (kcal), protein (g), carbohydrates (g), and fat (g) for the portion they described. Be specific and practical — favor concrete typical portions over vague answers.

Sources of truth: widely-accepted nutrition data for common foods (USDA FoodData Central averages, MyFitnessPal community averages), restaurant-chain published nutrition facts where applicable, and reasonable assumptions for home-cooked dishes.

Guidance:
- Default to typical/medium portions if size isn't specified, and note the assumption.
- For named restaurant items ("Big Mac", "Starbucks grande latte"), use the chain's official nutrition facts.
- For ambiguous foods ("salad", "pasta"), ask one short clarifying question rather than guessing wildly.
- For non-food questions or chitchat, respond conversationally and set the estimate to null.

Always respond with valid JSON matching the schema:
- "reply" (string, required): A friendly 1-2 sentence message. Explain the estimate briefly, ask for clarification, or chat. Do NOT restate the macros — the UI shows them next to your message.
- "estimate" (object or null, required): The nutrition object if you have a confident estimate; null otherwise.

The estimate object:
- name: Concise food name including the portion (e.g., "Caesar salad with grilled chicken (medium, ~3 cups)")
- servings: Always 1. Your nutrition values represent the entire portion described.
- calories, protein, carbs, fat: Whole numbers for the described portion.
- notes: One sentence noting assumptions (cooking method, portion basis, brand if relevant).

Examples:

User: "medium Caesar salad with grilled chicken"
{
  "reply": "Here's a typical estimate for a medium Caesar with grilled chicken.",
  "estimate": {
    "name": "Caesar salad with grilled chicken (medium)",
    "servings": 1,
    "calories": 470,
    "protein": 35,
    "carbs": 12,
    "fat": 31,
    "notes": "Assumes ~3 cups romaine, 4oz grilled chicken, 2 tbsp Caesar dressing, parmesan, and croutons."
  }
}

User: "I had pizza"
{
  "reply": "What style and how many slices? A typical slice of regular cheese pizza is around 280 kcal; deep dish or pepperoni runs higher.",
  "estimate": null
}

User: "two scrambled eggs on buttered whole wheat toast"
{
  "reply": "Estimated for 2 large eggs scrambled with a pat of butter on one slice of buttered whole-wheat toast.",
  "estimate": {
    "name": "2 scrambled eggs + buttered toast",
    "servings": 1,
    "calories": 330,
    "protein": 17,
    "carbs": 16,
    "fat": 22,
    "notes": "2 large eggs cooked with 1 tsp butter; 1 slice whole-wheat toast with 1 tsp butter."
  }
}`;

const NUTRITION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "estimate"],
  properties: {
    reply: {
      type: "string",
      description: "Friendly conversational reply, 1-2 sentences. Do not repeat the macros from the estimate.",
    },
    estimate: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["name", "servings", "calories", "protein", "carbs", "fat", "notes"],
          properties: {
            name: { type: "string", description: "Concise food name including portion descriptor." },
            servings: { type: "number", description: "Always 1 — represents the entire described portion." },
            calories: { type: "number", description: "Total kilocalories for the described portion." },
            protein: { type: "number", description: "Grams of protein." },
            carbs: { type: "number", description: "Grams of carbohydrates." },
            fat: { type: "number", description: "Grams of fat." },
            notes: { type: "string", description: "One sentence noting assumptions / caveats." },
          },
        },
        { type: "null" },
      ],
    },
  },
};

const chatHistoryEl = document.getElementById("chat-history");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send");
const chatConfigEl = document.getElementById("chat-config");
const chatClearBtn = document.getElementById("chat-clear");

let messages = loadHistory();
let sending = false;

function loadApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

function saveApiKey(key) {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  const trimmed = messages.slice(-MAX_HISTORY);
  localStorage.setItem(CHAT_HISTORY_STORAGE, JSON.stringify(trimmed));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderConfig() {
  const key = loadApiKey();
  chatConfigEl.innerHTML = "";

  if (!key) {
    const wrap = document.createElement("div");
    wrap.className = "api-key-form";
    wrap.innerHTML = `
      <p class="muted">Add your Anthropic API key to use the assistant. The key is stored in <strong>this browser only</strong> &mdash; never shared with anyone but Anthropic when you send a message.</p>
      <div class="api-key-row">
        <input type="password" id="api-key-input" placeholder="sk-ant-..." autocomplete="off" />
        <button type="button" id="api-key-save">Save key</button>
      </div>
      <p class="muted small">Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>. A typical nutrition lookup costs a fraction of a cent.</p>
    `;
    chatConfigEl.appendChild(wrap);
    document.getElementById("api-key-save").addEventListener("click", () => {
      const v = document.getElementById("api-key-input").value.trim();
      if (v) {
        saveApiKey(v);
        renderConfig();
        chatInput.focus();
      }
    });
    document.getElementById("api-key-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("api-key-save").click();
      }
    });
  } else {
    const masked = key.length > 14 ? key.slice(0, 10) + "…" + key.slice(-4) : "…" + key.slice(-4);
    const wrap = document.createElement("div");
    wrap.className = "api-key-row inline";
    wrap.innerHTML = `
      <span class="muted small">API key: <code>${escapeHtml(masked)}</code></span>
      <button type="button" class="btn-link" id="api-key-clear">Change key</button>
    `;
    chatConfigEl.appendChild(wrap);
    document.getElementById("api-key-clear").addEventListener("click", () => {
      saveApiKey("");
      renderConfig();
    });
  }
}

function renderChat() {
  chatHistoryEl.innerHTML = "";
  for (const msg of messages) {
    const el = document.createElement("div");
    el.className = "chat-msg chat-msg-" + msg.role;
    if (msg.isError) el.classList.add("chat-error");

    if (msg.role === "user") {
      el.textContent = msg.content;
    } else {
      const parsed = msg.parsed || { reply: msg.content, estimate: null };
      const reply = document.createElement("div");
      reply.className = "chat-reply";
      reply.textContent = parsed.reply || msg.content;
      el.appendChild(reply);
      if (parsed.estimate) el.appendChild(renderEstimateCard(parsed.estimate));
    }
    chatHistoryEl.appendChild(el);
  }
  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
}

function renderEstimateCard(estimate) {
  const card = document.createElement("div");
  card.className = "estimate-card";
  card.innerHTML = `
    <div class="estimate-head">${escapeHtml(estimate.name)}</div>
    <div class="estimate-macros">
      <span><strong>${Math.round(Number(estimate.calories) || 0)}</strong> kcal</span>
      <span><strong>${Math.round(Number(estimate.protein) || 0)}g</strong> protein</span>
      <span><strong>${Math.round(Number(estimate.carbs) || 0)}g</strong> carbs</span>
      <span><strong>${Math.round(Number(estimate.fat) || 0)}g</strong> fat</span>
    </div>
    <div class="estimate-notes muted small">${escapeHtml(estimate.notes || "")}</div>
    <button type="button" class="btn-secondary estimate-add">Add to log</button>
  `;
  card.querySelector(".estimate-add").addEventListener("click", (e) => {
    if (typeof window.addMealFromEstimate === "function") {
      window.addMealFromEstimate(estimate);
      const btn = e.currentTarget;
      btn.textContent = "Added ✓";
      btn.disabled = true;
    }
  });
  return card;
}

async function sendMessage(text) {
  if (sending) return;
  const apiKey = loadApiKey();
  if (!apiKey) {
    renderConfig();
    return;
  }

  sending = true;
  chatSendBtn.disabled = true;
  chatInput.disabled = true;

  messages.push({ role: "user", content: text });
  renderChat();

  const pendingEl = document.createElement("div");
  pendingEl.className = "chat-msg chat-msg-assistant chat-pending";
  pendingEl.textContent = "Thinking…";
  chatHistoryEl.appendChild(pendingEl);
  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

  try {
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content:
        m.role === "user"
          ? m.content
          : m.parsed
          ? JSON.stringify(m.parsed)
          : m.content,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: apiMessages,
        output_config: {
          format: { type: "json_schema", schema: NUTRITION_SCHEMA },
          effort: "low",
        },
      }),
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        errMsg = (errBody.error && errBody.error.message) || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    if (data.stop_reason === "refusal") {
      throw new Error(
        (data.stop_details && data.stop_details.explanation) ||
          "The model declined to answer."
      );
    }
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock || !textBlock.text) throw new Error("Empty response from the model.");

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      parsed = { reply: textBlock.text, estimate: null };
    }
    messages.push({ role: "assistant", content: textBlock.text, parsed });
    saveHistory();
  } catch (err) {
    messages.push({
      role: "assistant",
      isError: true,
      content: `Error: ${err.message}`,
      parsed: { reply: `Error: ${err.message}`, estimate: null },
    });
  } finally {
    pendingEl.remove();
    renderChat();
    sending = false;
    chatSendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  sendMessage(text);
});

chatClearBtn.addEventListener("click", () => {
  if (messages.length === 0) return;
  if (!confirm("Clear the chat history?")) return;
  messages = [];
  saveHistory();
  renderChat();
});

renderConfig();
renderChat();
