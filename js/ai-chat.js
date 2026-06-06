(() => {
  const CHAT_STORAGE_KEY = "gc_ai_chat_history_v1";
  const MAX_LOCAL_MESSAGES = 30;
  const MIN_SEND_INTERVAL_MS = 1200;
  const path = window.location.pathname || "";
  const isInnerPage = path.includes("/pages/");
  const API_BASE = isInnerPage ? "../api" : "api";
  const IMG_BASE = isInnerPage ? "../img" : "img";
  const API_URL = `${API_BASE}/ai-chat.php`;
  const FAQ_ADMIN_URL = `${API_BASE}/chat-faq-admin.php`;
  const CHECK_AUTH_URL = `${API_BASE}/check-auth.php`;

  const quickActions = [
    "Что это за сайт?",
    "Начать играть",
    "Связаться с поддержкой",
  ];

  const state = {
    opened: false,
    isSending: false,
    lastSendAt: 0,
    hasGreeted: false,
    localHistory: [],
    isAdmin: false,
    faqItems: [],
    currentFaqIndex: -1,
  };

  async function parseApiResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(rawText);
      } catch {
        return { ok: false, error: "Некорректный JSON от сервера." };
      }
    }

    const shortText = String(rawText || "").trim().slice(0, 180);
    return {
      ok: false,
      error: shortText ? `Сервер вернул не-JSON: ${shortText}` : "Сервер вернул пустой ответ.",
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createUI() {
    const root = document.createElement("div");
    root.className = "ai-chat";
    root.innerHTML = `
      <button class="ai-chat__fab" id="aiChatFab" aria-label="Открыть AI чат">
        <img class="ai-chat__fab-icon" src="img/chat-bot.png" alt="AI бот" />
      </button>

      <section class="ai-chat__panel" id="aiChatPanel" aria-hidden="true">
        <header class="ai-chat__header">
          <div>
            <div class="ai-chat__title">Pixel</div>
            <div class="ai-chat__status" id="aiChatStatus">онлайн</div>
          </div>
          <div class="ai-chat__actions">
            <button class="ai-chat__admin-btn hidden" id="aiChatAdminBtn" type="button">FAQ ADMIN</button>
            <button class="ai-chat__close" id="aiChatClose" aria-label="Закрыть чат">×</button>
          </div>
        </header>

        <div class="ai-chat__quick" id="aiChatQuick"></div>
        <div class="ai-chat__messages" id="aiChatMessages"></div>

        <form class="ai-chat__form" id="aiChatForm">
          <input
            class="ai-chat__input"
            id="aiChatInput"
            type="text"
            autocomplete="off"
            maxlength="500"
            placeholder="Напиши вопрос..."
          />
          <button class="ai-chat__send" id="aiChatSend" type="submit">
            <span class="ai-chat__send-text">Отправить</span>
            <span class="ai-chat__send-loader" aria-hidden="true"></span>
          </button>
        </form>
      </section>

      <section class="ai-chat-admin hidden" id="aiChatAdmin">
        <div class="ai-chat-admin__box">
          <div class="ai-chat-admin__head">
            <div class="ai-chat-admin__title">FAQ РЕДАКТОР</div>
            <button class="ai-chat-admin__close" id="aiChatAdminClose" type="button">×</button>
          </div>
          <div class="ai-chat-admin__body">
            <div class="ai-chat-admin__left">
              <button class="ai-chat-admin__new" id="aiChatAdminNew" type="button">+ НОВЫЙ ВОПРОС</button>
              <div class="ai-chat-admin__list" id="aiChatAdminList"></div>
            </div>
            <div class="ai-chat-admin__right">
              <label class="ai-chat-admin__label">Вопрос</label>
              <input class="ai-chat-admin__input" id="faqQuestion" type="text" maxlength="180" />
              <label class="ai-chat-admin__label">Ключевые слова (через запятую)</label>
              <input class="ai-chat-admin__input" id="faqKeywords" type="text" maxlength="400" />
              <label class="ai-chat-admin__label">Ответ</label>
              <textarea class="ai-chat-admin__textarea" id="faqAnswer" maxlength="1500"></textarea>
              <div class="ai-chat-admin__controls">
                <button class="ai-chat-admin__btn" id="faqSaveItem" type="button">СОХРАНИТЬ ПУНКТ</button>
                <button class="ai-chat-admin__btn ai-chat-admin__btn--danger" id="faqDeleteItem" type="button">УДАЛИТЬ</button>
                <button class="ai-chat-admin__btn ai-chat-admin__btn--accent" id="faqSaveAll" type="button">СОХРАНИТЬ ВСЕ</button>
              </div>
              <div class="ai-chat-admin__status" id="faqAdminStatus"></div>
            </div>
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(root);
  }

  function normalizeBotIconPath() {
    const icon = document.querySelector(".ai-chat__fab-icon");
    if (icon) {
      icon.src = `${IMG_BASE}/chat-bot.png`;
    }
  }

  function loadLocalHistory() {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
    } catch {
      return [];
    }
  }

  function saveLocalHistory(messages) {
    const trimmed = messages.slice(-MAX_LOCAL_MESSAGES);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  }

  function addMessage(role, content, shouldPersist = true) {
    const messagesEl = document.getElementById("aiChatMessages");
    const bubble = document.createElement("div");
    bubble.className = `ai-chat__msg ai-chat__msg--${role}`;
    bubble.innerHTML = `<span>${escapeHtml(content)}</span>`;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (shouldPersist && (role === "user" || role === "assistant")) {
      state.localHistory.push({ role, content });
      state.localHistory = state.localHistory.slice(-MAX_LOCAL_MESSAGES);
      saveLocalHistory(state.localHistory);
    }
  }

  function showTyping(show) {
    const messagesEl = document.getElementById("aiChatMessages");
    const existing = document.getElementById("aiChatTyping");
    if (show) {
      if (existing) return;
      const typing = document.createElement("div");
      typing.id = "aiChatTyping";
      typing.className = "ai-chat__msg ai-chat__msg--assistant ai-chat__typing";
      typing.innerHTML = `
        <span class="ai-chat__typing-dots">
          <i></i><i></i><i></i>
        </span>
        <small>печатает...</small>
      `;
      messagesEl.appendChild(typing);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return;
    }
    if (existing) existing.remove();
  }

  function setSending(isSending) {
    state.isSending = isSending;
    const btn = document.getElementById("aiChatSend");
    btn.disabled = isSending;
    btn.classList.toggle("is-loading", isSending);
  }

  function renderQuickActions() {
    const container = document.getElementById("aiChatQuick");
    container.innerHTML = "";
    quickActions.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-chat__quick-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        void sendUserMessage(label);
      });
      container.appendChild(btn);
    });
  }

  function setAdminStatus(text, isError = false) {
    const el = document.getElementById("faqAdminStatus");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", isError);
  }

  function renderFaqList() {
    const list = document.getElementById("aiChatAdminList");
    if (!list) return;
    list.innerHTML = "";

    state.faqItems.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-chat-admin__item";
      if (idx === state.currentFaqIndex) btn.classList.add("active");
      btn.textContent = `${idx + 1}. ${item.question}`;
      btn.addEventListener("click", () => loadFaqItemIntoForm(idx));
      list.appendChild(btn);
    });
  }

  function loadFaqItemIntoForm(index) {
    const item = state.faqItems[index];
    if (!item) return;
    state.currentFaqIndex = index;
    document.getElementById("faqQuestion").value = item.question || "";
    document.getElementById("faqKeywords").value = Array.isArray(item.keywords) ? item.keywords.join(", ") : "";
    document.getElementById("faqAnswer").value = item.answer || "";
    renderFaqList();
  }

  function readFaqForm() {
    const question = document.getElementById("faqQuestion").value.trim();
    const answer = document.getElementById("faqAnswer").value.trim();
    const keywordsRaw = document.getElementById("faqKeywords").value;
    const keywords = keywordsRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return { question, keywords, answer };
  }

  async function loadFaqAdminItems() {
    try {
      setAdminStatus("Загрузка FAQ...");
      const res = await fetch(FAQ_ADMIN_URL, { cache: "no-store", credentials: "same-origin" });
      const data = await parseApiResponse(res);
      if (!res.ok || !data.ok) {
        setAdminStatus(data.error || "Ошибка загрузки FAQ", true);
        return;
      }
      state.faqItems = Array.isArray(data.items) ? data.items : [];
      if (state.faqItems.length > 0) {
        loadFaqItemIntoForm(0);
      } else {
        state.currentFaqIndex = -1;
        document.getElementById("faqQuestion").value = "";
        document.getElementById("faqKeywords").value = "";
        document.getElementById("faqAnswer").value = "";
      }
      renderFaqList();
      setAdminStatus(`Загружено пунктов: ${state.faqItems.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setAdminStatus(`Ошибка загрузки: ${msg}`, true);
    }
  }

  async function saveFaqAll() {
    try {
      setAdminStatus("Сохранение...");
      const res = await fetch(FAQ_ADMIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ items: state.faqItems }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok || !data.ok) {
        setAdminStatus(data.error || "Ошибка сохранения FAQ", true);
        return;
      }
      setAdminStatus(`Сохранено: ${data.saved_count ?? state.faqItems.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setAdminStatus(`Ошибка сохранения: ${msg}`, true);
    }
  }

  async function detectAdmin() {
    try {
      const res = await fetch(CHECK_AUTH_URL, { credentials: "same-origin", cache: "no-store" });
      const data = await parseApiResponse(res);
      if (!res.ok || !data || !data.loggedIn) return;
      const nickname = String(data.nickname || "").trim().toLowerCase();
      state.isAdmin = ["firas", "llinajoo", "admin"].includes(nickname);
      if (state.isAdmin) {
        document.getElementById("aiChatAdminBtn")?.classList.remove("hidden");
      }
    } catch {}
  }

  function restoreChatHistory() {
    state.localHistory = loadLocalHistory();
    if (state.localHistory.length === 0) return;
    state.localHistory.forEach((msg) => addMessage(msg.role, msg.content, false));
    state.hasGreeted = true;
  }

  function openPanel() {
    const panel = document.getElementById("aiChatPanel");
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    state.opened = true;

    if (!state.hasGreeted) {
      addMessage(
        "assistant",
        "Привет! Я AI-ассистент GameCode. Помогу с играми, теорией, демо и поддержкой."
      );
      state.hasGreeted = true;
    }
  }

  function closePanel() {
    const panel = document.getElementById("aiChatPanel");
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    state.opened = false;
  }

  async function sendUserMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || state.isSending) return;

    const now = Date.now();
    if (now - state.lastSendAt < MIN_SEND_INTERVAL_MS) return;
    state.lastSendAt = now;

    addMessage("user", text);
    showTyping(true);
    setSending(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: state.localHistory.slice(-12),
        }),
      });

      const data = await parseApiResponse(response);
      showTyping(false);

      if (!response.ok || !data.ok) {
        addMessage("assistant", data.error || "Ошибка сервера. Попробуй снова чуть позже.");
        return;
      }

      addMessage("assistant", data.reply || "Я пока не смог сформировать ответ.");
    } catch (err) {
      showTyping(false);
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      addMessage("assistant", `Проблема с сетью/API: ${msg}`);
    } finally {
      setSending(false);
    }
  }

  function bindEvents() {
    const fab = document.getElementById("aiChatFab");
    const close = document.getElementById("aiChatClose");
    const form = document.getElementById("aiChatForm");
    const input = document.getElementById("aiChatInput");
    const adminBtn = document.getElementById("aiChatAdminBtn");
    const adminPanel = document.getElementById("aiChatAdmin");
    const adminClose = document.getElementById("aiChatAdminClose");
    const newFaqBtn = document.getElementById("aiChatAdminNew");
    const saveItemBtn = document.getElementById("faqSaveItem");
    const delItemBtn = document.getElementById("faqDeleteItem");
    const saveAllBtn = document.getElementById("faqSaveAll");

    fab.addEventListener("click", () => {
      if (state.opened) {
        closePanel();
        return;
      }
      openPanel();
      input.focus();
    });

    close.addEventListener("click", closePanel);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      void sendUserMessage(text);
    });

    adminBtn?.addEventListener("click", async () => {
      if (!state.isAdmin) return;
      adminPanel?.classList.remove("hidden");
      await loadFaqAdminItems();
    });

    adminClose?.addEventListener("click", () => {
      adminPanel?.classList.add("hidden");
    });

    newFaqBtn?.addEventListener("click", () => {
      state.currentFaqIndex = -1;
      document.getElementById("faqQuestion").value = "";
      document.getElementById("faqKeywords").value = "";
      document.getElementById("faqAnswer").value = "";
      renderFaqList();
      setAdminStatus("Новый пункт");
    });

    saveItemBtn?.addEventListener("click", () => {
      const item = readFaqForm();
      if (!item.question || !item.answer || item.keywords.length === 0) {
        setAdminStatus("Заполни вопрос, ключи и ответ", true);
        return;
      }
      if (state.currentFaqIndex >= 0) {
        state.faqItems[state.currentFaqIndex] = item;
      } else {
        state.faqItems.push(item);
        state.currentFaqIndex = state.faqItems.length - 1;
      }
      renderFaqList();
      setAdminStatus("Пункт обновлен. Нажми «СОХРАНИТЬ ВСЕ»");
    });

    delItemBtn?.addEventListener("click", () => {
      if (state.currentFaqIndex < 0) {
        setAdminStatus("Сначала выбери пункт", true);
        return;
      }
      state.faqItems.splice(state.currentFaqIndex, 1);
      if (state.faqItems.length > 0) {
        loadFaqItemIntoForm(Math.max(0, state.currentFaqIndex - 1));
      } else {
        state.currentFaqIndex = -1;
        document.getElementById("faqQuestion").value = "";
        document.getElementById("faqKeywords").value = "";
        document.getElementById("faqAnswer").value = "";
      }
      renderFaqList();
      setAdminStatus("Пункт удален. Сохраняю в БД...");
      void saveFaqAll();
    });

    saveAllBtn?.addEventListener("click", () => {
      void saveFaqAll();
    });
  }

  function shouldRenderChat() {
    const normalizedPath = String(path || "").toLowerCase();
    if (normalizedPath.includes("/admin/") || normalizedPath.endsWith("/admin") || normalizedPath.includes("/admin.")) {
      return false;
    }
    return true;
  }

  async function init() {
    if (!shouldRenderChat()) return;
    createUI();
    normalizeBotIconPath();
    renderQuickActions();
    restoreChatHistory();
    bindEvents();
    await detectAdmin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
