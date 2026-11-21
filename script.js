
/* VIANA — رابط کاربری و API */
(() => {
  "use strict";

const API_URL = "https://viana-api.onrender.com";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const token = () => localStorage.getItem("securityChatToken");

  const currentUser = () => {
    try {
      return JSON.parse(localStorage.getItem("securityChatUser") || "{}");
    } catch {
      return {};
    }
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const knownMessages = new Map();

  const state = {
    activeContact: null,
    filter: "all",
    search: "",
    requestId: 0,
    refreshTimer: null,
    replyTo: "",
    remoteContacts: [],
    cartCount: 0
  };

  function toast(message) {
    const el = $("#toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  async function api(path, options = {}) {
    const headers = { Accept: "application/json" };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (token()) {
      headers.Authorization = `Bearer ${token()}`;
    }

    let response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body)
      });
    } catch {
      throw new Error("اتصال به سرور برقرار نشد. مطمئن شو سرور پایتون روشن است.");
    }

    let data = {};

    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      let message = data.detail || data.message || `خطای ${response.status}`;

      if (Array.isArray(message)) {
        message = message.map(x => x.msg || "اطلاعات نامعتبر").join("، ");
      }

      if (response.status === 401) {
        localStorage.removeItem("securityChatToken");
        localStorage.removeItem("securityChatUser");

        toast("نشست ورود منقضی شده؛ دوباره وارد شو.");

        setTimeout(() => location.replace("login.html"), 900);
      }

      throw new Error(message);
    }

    return data;
  }

  function isRemote(contact) {
    return Boolean(contact && UUID_RE.test(String(contact.id || "")));
  }

  function timeText(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function safeText(element, value) {
    if (element) element.textContent = value ?? "";
  }

  // -------- اعلان‌ها --------

  async function enableNotifications() {
    if (!("Notification" in window)) {
      toast("مرورگر شما از اعلان پشتیبانی نمی‌کند.");
      return;
    }

    if (Notification.permission === "granted") {
      toast("اعلان‌های VIANA فعال هستند. 💗");
      return;
    }

    if (Notification.permission === "denied") {
      toast("اجازه اعلان مسدود شده است. از تنظیمات سایت آن را فعال کن.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        toast("اعلان‌های VIANA با موفقیت فعال شدند. 🔔");
      } else {
        toast("اجازه اعلان داده نشد.");
      }
    } catch (error) {
      console.error("Notification error:", error);
      toast("فعال‌سازی اعلان انجام نشد.");
    }
  }

  // -------- سیستم صداهای اعلان VIANA --------

  function notificationSettingsKey() {
    const user = currentUser();
    return `vianaNotificationSettings_${user.id || user.username || "guest"}`;
  }

  function getNotificationSettings() {
    try {
      return JSON.parse(
        localStorage.getItem(notificationSettingsKey())
      ) || {};
    } catch {
      return {};
    }
  }

  function saveNotificationSettings(settings) {
    localStorage.setItem(
      notificationSettingsKey(),
      JSON.stringify(settings)
    );
  }

  let vianaAudioContext = null;

  async function playNotificationSound() {
    const settings = getNotificationSettings();

    if (settings.enabled === false) return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      toast("مرورگر از پخش صدای اعلان پشتیبانی نمی‌کند.");
      return;
    }

    try {
      if (!vianaAudioContext) {
        vianaAudioContext = new AudioContextClass();
      }

      if (vianaAudioContext.state === "suspended") {
        await vianaAudioContext.resume();
      }

      const sounds = {
        classic: {
          notes: [660, 880],
          wave: "sine",
          duration: 0.13
        },
        soft: {
          notes: [523, 659],
          wave: "sine",
          duration: 0.22
        },
        digital: {
          notes: [880, 1175, 880],
          wave: "square",
          duration: 0.09
        },
        pop: {
          notes: [740, 520],
          wave: "triangle",
          duration: 0.10
        },
        crystal: {
          notes: [1046, 1318, 1568],
          wave: "sine",
          duration: 0.18
        },
        luxury: {
          notes: [587, 740, 880],
          wave: "triangle",
          duration: 0.24
        }
      };

      const selected = sounds[settings.sound] || sounds.soft;
      const volume = Math.max(
        0,
        Math.min(1, Number(settings.volume ?? 0.45))
      );

      const start = vianaAudioContext.currentTime;

      selected.notes.forEach((frequency, index) => {
        const oscillator = vianaAudioContext.createOscillator();
        const gain = vianaAudioContext.createGain();

        const noteStart =
          start + index * selected.duration * 0.85;

        oscillator.type = selected.wave;
        oscillator.frequency.setValueAtTime(
          frequency,
          noteStart
        );

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(
          volume * 0.16,
          noteStart + 0.025
        );

        gain.gain.exponentialRampToValueAtTime(
          0.001,
          noteStart + selected.duration
        );

        oscillator.connect(gain);
        gain.connect(vianaAudioContext.destination);

        oscillator.start(noteStart);
        oscillator.stop(noteStart + selected.duration + 0.02);
      });

    } catch (error) {
      console.warn("VIANA sound:", error);
    }
  }

  // -------- صفحات اصلی --------

  const pageNames = {
    messenger: "پیام‌رسان",
    world: "ویانا ورلد",
    market: "ویانا مارکت",
    settings: "تنظیمات"
  };

  function showPage(name) {
    if (!pageNames[name]) return;

    $$(".page").forEach(page => {
      page.classList.toggle("active", page.id === `page-${name}`);
    });

    $$(".rail-btn[data-page]").forEach(button => {
      button.classList.toggle("active", button.dataset.page === name);
    });

    safeText($("#topContext"), pageNames[name]);

    if (name === "messenger") renderChatList();
  }

  $$("[data-page]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  // -------- پنجره‌های عمومی --------

  const backdrop = $("#modalBackdrop");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");

  function openModal(title, content) {
    safeText(modalTitle, title);

    if (modalBody) {
      modalBody.replaceChildren();

      if (typeof content === "string") {
        modalBody.innerHTML = content;
      } else if (content) {
        modalBody.appendChild(content);
      }
    }

    backdrop?.classList.add("open");
  }

  function closeModal() {
    backdrop?.classList.remove("open");
  }

  $("#modalClose")?.addEventListener("click", closeModal);

  backdrop?.addEventListener("click", event => {
    if (event.target === backdrop) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

  // -------- گفت‌وگوها و مخاطب‌ها --------

  const chatList = $("#chatList");
  const messagesArea = $("#messagesArea");
  const messageInput = $("#messageInput");
  const sendButton = $("#sendBtn");
  const messengerLayout = $(".messenger-layout");

  function getSavedContacts() {
    try {
      const list = JSON.parse(localStorage.getItem("vianaRemoteContacts") || "[]");

      return Array.isArray(list)
        ? list.filter(item => item && UUID_RE.test(String(item.id)))
        : [];
    } catch {
      return [];
    }
  }

  function saveContact(contact) {
    const list = getSavedContacts();

    if (!list.some(item => item.id === contact.id)) {
      list.unshift(contact);
      localStorage.setItem("vianaRemoteContacts", JSON.stringify(list));
    }
  }

  function renderChatList() {
    if (!chatList) return;

    const items = $$(".chat-item", chatList);

    items.forEach(item => {
      const kind = item.dataset.kind || "personal";
      const text = item.textContent.toLocaleLowerCase("fa");

      const matchesSearch = text.includes(state.search);

      const matchesFilter =
        state.filter === "all" ||
        (state.filter === "personal" && kind === "personal") ||
        (state.filter === "groups" && kind === "groups") ||
        (state.filter === "unread" && Boolean($(".unread-count", item)));

      item.hidden = !(matchesSearch && matchesFilter);
    });
  }

  function makeContactItem(contact) {
    if (!chatList || $(`.chat-item[data-user-id="${CSS.escape(String(contact.id))}"]`, chatList)) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-item";
    button.dataset.kind = "personal";
    button.dataset.userId = contact.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar a-violet";
    avatar.textContent = (contact.username || "?").slice(0, 1).toUpperCase();

    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const line1 = document.createElement("div");
    line1.className = "chat-line";

    const name = document.createElement("strong");
    name.textContent = contact.username;

    const time = document.createElement("time");
    time.textContent = "جدید";

    line1.append(name, time);

    const line2 = document.createElement("div");
    line2.className = "chat-line";

    const preview = document.createElement("p");
    preview.textContent = "شروع گفت‌وگوی جدید";

    line2.appendChild(preview);
    meta.append(line1, line2);
    button.append(avatar, meta);

    chatList.prepend(button);

    button.addEventListener("click", () => openRemoteContact(contact, button));

    renderChatList();
  }

  function clearActiveChatStyles() {
    $$(".chat-item", chatList || document).forEach(item => {
      item.classList.remove("selected");
    });
  }

  function updateHeader(contact) {
    safeText($("#contactName"), contact.username || contact.name || "گفتگو");
    safeText($("#detailName"), contact.username || contact.name || "گفتگو");

    const status = $("#contactStatus");

    if (status) {
      status.innerHTML = '<span class="live-dot"></span> گفت‌وگوی خصوصی';
    }

    const avatar = $(".contact-summary .avatar");

    if (avatar) {
      avatar.className = "avatar a-violet large";
      avatar.textContent = (contact.username || contact.name || "?").slice(0, 1).toUpperCase();
    }

    const detailAvatar = $(".profile-hero .avatar");

    if (detailAvatar) {
      detailAvatar.className = "avatar a-violet xlarge";
      detailAvatar.textContent = (contact.username || contact.name || "?").slice(0, 1).toUpperCase();
    }

    const detailHandle = $(".profile-hero > p");

    safeText(detailHandle, `@${contact.username || "user"} · کاربر VIANA`);
  }

  function renderMessage(item, mine) {
    const row = document.createElement("div");
    row.className = `message-row ${mine ? "outgoing" : "incoming"}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const text = document.createElement("p");
    text.textContent = item.content || "";

    const foot = document.createElement("div");
    foot.className = "bubble-foot";

    const time = document.createElement("time");
    time.textContent = timeText(item.created_at);

    foot.appendChild(time);

    if (mine) {
      const ticks = document.createElement("span");
      ticks.className = "read-ticks";
      ticks.textContent = "✓";
      foot.appendChild(ticks);
    } else {
      const react = document.createElement("button");
      react.type = "button";
      react.className = "reaction-trigger";
      react.textContent = "☺";
      react.title = "واکنش";

      react.addEventListener("click", () => {
        const value = prompt("واکنش را وارد کن:", "💗");
        if (value) toast(`واکنش ${value} انتخاب شد.`);
      });

      foot.appendChild(react);
    }

    bubble.append(text, foot);
    row.appendChild(bubble);

    return row;
  }

  function showEmptyConversation(message) {
    if (!messagesArea) return;

    messagesArea.replaceChildren();

    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = message;

    messagesArea.appendChild(empty);
  }

  // -------- دریافت پیام‌ها و تشخیص پیام جدید --------

  async function loadConversation(contact) {
    if (!isRemote(contact)) return;

    const requestId = ++state.requestId;

    const data = await api(
      `/messages/${encodeURIComponent(contact.id)}?limit=100`
    );

    if (
      requestId !== state.requestId ||
      !state.activeContact ||
      state.activeContact.id !== contact.id
    ) {
      return;
    }

    const user = currentUser();
    const rows = Array.isArray(data.messages) ? data.messages : [];

    const contactKey = String(contact.id);

    const messageKey = item =>
      String(item.id || `${item.sender_id}|${item.created_at}|${item.content}`);

    let known = knownMessages.get(contactKey);

    if (!known) {
      known = new Set(rows.map(messageKey));
      knownMessages.set(contactKey, known);
    } else {
      const newMessages = rows.filter(item =>
        !known.has(messageKey(item)) &&
        String(item.sender_id) !== String(user.id)
      );

      rows.forEach(item => known.add(messageKey(item)));

      if (newMessages.length) {
        newMessages.forEach(item => {
          const messageText = String(item.content || "");

          toast(
            `پیام جدید از ${contact.username}: ${messageText.slice(0, 50)}`
          );
        playNotificationSound();
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            try {
              new Notification("پیام جدید در VIANA", {
                body: `${contact.username}: ${messageText.slice(0, 100)}`
              });
            } catch (error) {
              console.warn("VIANA notification:", error);
            }
          }
        });
      }
    }

    const fragment = document.createDocumentFragment();

    const divider = document.createElement("div");
    divider.className = "date-divider";

    const dividerText = document.createElement("span");
    dividerText.textContent = "پیام‌های گفتگو";

    divider.appendChild(dividerText);
    fragment.appendChild(divider);

    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "هنوز پیامی وجود ندارد؛ اولین پیام را بفرست.";

      fragment.appendChild(empty);
    } else {
      rows.forEach(item => {
        fragment.appendChild(
          renderMessage(item, String(item.sender_id) === String(user.id))
        );
      });
    }

    messagesArea?.replaceChildren(fragment);

    if (messagesArea) {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  }

  async function openRemoteContact(contact, button = null) {
    state.activeContact = contact;
    window.SecurityChatActiveContact = contact;

    clearActiveChatStyles();

    if (button) {
      button.classList.add("selected");
    } else {
      const existing = $(
        `.chat-item[data-user-id="${CSS.escape(String(contact.id))}"]`,
        chatList || document
      );

      existing?.classList.add("selected");
    }

    updateHeader(contact);

    messengerLayout?.classList.add("chat-open");

    showEmptyConversation("در حال دریافت پیام‌ها...");

    try {
      await loadConversation(contact);
    } catch (error) {
      showEmptyConversation(`دریافت پیام‌ها ناموفق بود: ${error.message}`);
    }
  }

  // -------- مخاطب‌های نمایشی --------

  $$(".chat-item", chatList || document).forEach(item => {
    item.addEventListener("click", () => {
      if (item.dataset.userId) {
        const contact = getSavedContacts().find(
          c => c.id === item.dataset.userId
        );

        if (contact) openRemoteContact(contact, item);
        return;
      }

      clearActiveChatStyles();

      item.classList.add("selected");

      state.activeContact = null;
      window.SecurityChatActiveContact = null;
      state.requestId++;

      const title = $("strong", item)?.textContent?.trim() || "گفتگو";

      safeText($("#contactName"), title);
      safeText($("#detailName"), title);
      safeText($("#contactStatus"), "گفت‌وگوی نمایشی");

      messengerLayout?.classList.add("chat-open");

      const demo = item.dataset.chat === "sara"
        ? [
            "سلام دونیا جان! خوبی؟ 💗",
            "سلام عزیزم، مرسییی! تو خوبی؟",
            "اون تم جدید رو دیدی؟ ✨"
          ]
        : ["این یک گفت‌وگوی نمونه در رابط VIANA است."];

      if (messagesArea) {
        messagesArea.replaceChildren();

        demo.forEach((text, index) => {
          const row = renderMessage(
            { content: text, created_at: new Date() },
            index % 2 === 1
          );

          messagesArea.appendChild(row);
        });
      }

      toast("این گفتگو نمونه است؛ برای ارسال واقعی، از + یک کاربر ثبت‌نام‌شده را پیدا کن.");
    });
  });

  // -------- جستجو و فیلتر گفتگوها --------

  $("#chatSearch")?.addEventListener("input", event => {
    state.search = event.target.value.trim().toLocaleLowerCase("fa");
    renderChatList();
  });

  $$(".filter[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;

      $$(".filter[data-filter]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderChatList();
    });
  });

  // -------- افزودن مخاطب جدید --------

  function addNewContactDialog() {
    const wrapper = document.createElement("div");

    const intro = document.createElement("p");
    intro.className = "modal-body-text";
    intro.textContent = "نام کاربری دقیق فردی را وارد کن که در VIANA ثبت‌نام کرده است.";

    const field = document.createElement("input");
    field.className = "modal-input";
    field.placeholder = "نام کاربری، حداقل ۲ حرف";
    field.autocomplete = "off";

    const results = document.createElement("div");
    results.className = "search-results";

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const search = document.createElement("button");
    search.className = "primary-action";
    search.textContent = "جستجوی کاربران";

    const cancel = document.createElement("button");
    cancel.className = "secondary-action";
    cancel.textContent = "انصراف";

    cancel.addEventListener("click", closeModal);

    search.addEventListener("click", async () => {
      const query = field.value.trim().replace(/^@+/, "");

      if (query.length < 2) {
        toast("حداقل دو حرف وارد کن.");
        field.focus();
        return;
      }

      if (!token()) {
        toast("ابتدا وارد حساب کاربری شو.");
        return;
      }

      search.disabled = true;
      search.textContent = "در حال جستجو...";
      results.replaceChildren();

      try {
        const data = await api(
          `/users/search?q=${encodeURIComponent(query)}`
        );

        const users = Array.isArray(data.users) ? data.users : [];

        if (!users.length) {
          const noResult = document.createElement("p");
          noResult.className = "modal-body-text";
          noResult.textContent = "کاربری با این عبارت پیدا نشد.";

          results.appendChild(noResult);
        } else {
          users.forEach(user => {
            const row = document.createElement("div");
            row.className = "setting-row";

            const label = document.createElement("div");

            const name = document.createElement("strong");
            name.textContent = user.username;

            const hint = document.createElement("small");
            hint.textContent = "کاربر ثبت‌نام‌شده VIANA";

            label.append(name, hint);

            const add = document.createElement("button");
            add.className = "primary-action";
            add.textContent = "شروع گفتگو";

            add.addEventListener("click", () => {
              saveContact(user);
              makeContactItem(user);
              closeModal();
              openRemoteContact(user);

              toast(`گفتگو با ${user.username} آماده است.`);
            });

            row.append(label, add);
            results.appendChild(row);
          });
        }
      } catch (error) {
        const err = document.createElement("p");
        err.className = "modal-body-text";
        err.textContent = `جستجو انجام نشد: ${error.message}`;

        results.appendChild(err);
      } finally {
        search.disabled = false;
        search.textContent = "جستجوی کاربران";
      }
    });

    field.addEventListener("keydown", event => {
      if (event.key === "Enter") search.click();
    });

    actions.append(cancel, search);
    wrapper.append(intro, field, actions, results);

    openModal("گفت‌وگوی جدید", wrapper);

    setTimeout(() => field.focus(), 30);
  }

  $("#newChat")?.addEventListener("click", addNewContactDialog);

  $("#searchToggle")?.addEventListener("click", () => {
    showPage("messenger");
    $("#chatSearch")?.focus();
  });

  // -------- ارسال پیام --------

  async function sendMessage() {
    const text = messageInput?.value.trim();

    if (!text) return;

    if (!state.activeContact || !isRemote(state.activeContact)) {
      toast("برای ارسال واقعی، ابتدا از + یک کاربر ثبت‌نام‌شده را انتخاب کن.");
      return;
    }

    if (!token()) {
      toast("نشست ورود پیدا نشد؛ دوباره وارد شو.");
      return;
    }

    if (sendButton) sendButton.disabled = true;

    try {
      await api("/messages/send", {
        method: "POST",
        body: {
          recipient_id: state.activeContact.id,
          content: text
        }
      });

      messageInput.value = "";
      state.replyTo = "";

      const preview = $("#replyPreview");

      if (preview) preview.hidden = true;

      await loadConversation(state.activeContact);
    } catch (error) {
      toast(`ارسال پیام ناموفق بود: ${error.message}`);
    } finally {
      if (sendButton) sendButton.disabled = false;
      messageInput?.focus();
    }
  }

  sendButton?.addEventListener("click", sendMessage);

  messageInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $("#clearReply")?.addEventListener("click", () => {
    state.replyTo = "";

    const preview = $("#replyPreview");

    if (preview) preview.hidden = true;
  });

  // -------- ابزار پیام‌رسان --------

  $("#emojiBtn")?.addEventListener("click", () => {
    const emojis = [
      "😀", "😂", "🥰", "😍", "💗", "✨",
      "🌸", "👍", "🔥", "🙏", "❤️", "🎉"
    ];

    const chosen = prompt(
      `ایموجی موردنظر را انتخاب کن:\n${emojis.join(" ")}`,
      "💗"
    );

    if (chosen && messageInput) {
      messageInput.value += chosen;
      messageInput.focus();
    }
  });

  $("#attachBtn")?.addEventListener("click", () => {
    toast("ارسال فایل هنوز به فضای ذخیره‌سازی متصل نشده است.");
  });

  $("#voiceBtn")?.addEventListener("click", () => {
    toast("قابلیت ضبط و ارسال پیام صوتی هنوز فعال نشده است.");
  });

  $("#chatAppearance")?.addEventListener("click", () => {
    showPage("settings");
    openSettingsSection("appearance");
  });

  $("#contactInfo")?.addEventListener("click", () => {
    $("#detailsPanel")?.classList.toggle("show");
  });

  $("#closeDetails")?.addEventListener("click", () => {
    $("#detailsPanel")?.classList.remove("show");
  });

  // -------- ظاهر و تنظیمات --------

  const themes = [
    ["cherry", "Cherry Noir", "theme-cherry"],
    ["midnight", "Cyber Blue", "theme-midnight"],
    ["lavender", "Plum Lavender", "theme-lavender"],
    ["light", "Soft Light", "theme-light"],
    ["minimal", "Minimal", "theme-minimal"],
    ["pinterest", "Pinterest Mood", "theme-pinterest"]
  ];

  function applyTheme(theme) {
    const allowed = themes.some(item => item[0] === theme)
      ? theme
      : "cherry";

    document.body.dataset.theme = allowed;

    document.body.classList.toggle(
      "light-theme",
      allowed === "light" || allowed === "pinterest"
    );

    localStorage.setItem("vianaTheme", allowed);

    renderThemeOptions();
  }

  function renderThemeOptions() {
    $$(".theme-option").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.theme === document.body.dataset.theme
      );
    });
  }

  applyTheme(
    localStorage.getItem("vianaTheme") ||
    document.body.dataset.theme ||
    "cherry"
  );

  function openSettingsSection(section) {
    $$(".settings-link").forEach(button => {
      button.classList.toggle("active", button.dataset.setting === section);
    });

    const target = $("#settingsContent");

    if (!target) return;

    const titles = {
      appearance: ["ظاهر و شخصی‌سازی", "فضای VIANA را مطابق سلیقه خودت تنظیم کن."],
      account: ["حساب کاربری", "اطلاعات حساب و نشست فعلی."],
      privacy: ["حریم خصوصی", "کنترل نمایش اطلاعات و تعاملات."],
      security: ["امنیت", "تنظیمات امنیتی حساب."],
      notifications: ["اعلان‌ها", "مدیریت اعلان‌های گفتگوها."],
      chats: ["گفتگوها", "تنظیمات تجربه پیام‌رسان."],
      storage: ["داده و حافظه", "مدیریت داده‌های ذخیره‌شده در این مرورگر."],
      language: ["زبان و دسترس‌پذیری", "گزینه‌های نمایش و خوانایی."],
      icons: ["مجموعه آیکون‌ها", "سبک آیکون‌های رابط را انتخاب کن."]
    };

    const info = titles[section] || titles.appearance;

    target.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = info[0];

    const intro = document.createElement("p");
    intro.className = "settings-intro";
    intro.textContent = info[1];

    target.append(heading, intro);

    if (section === "appearance") {
      const sectionEl = document.createElement("div");
      sectionEl.className = "setting-section";

      sectionEl.innerHTML = `
        <h3>انتخاب تم</h3>
        <p>یکی از فضاهای رنگی VIANA را انتخاب کن.</p>
        <div class="theme-grid">
          ${themes.map(([id, name, cls]) => `
            <button type="button"
              class="theme-option ${document.body.dataset.theme === id ? "active" : ""}"
              data-theme="${id}">
              <div class="theme-preview ${cls}"></div>
              <b>${name}</b>
              <small>
                ${id === "cherry" ? "گرم و عمیق" :
                  id === "midnight" ? "آبی و مدرن" :
                  id === "lavender" ? "آرام و لطیف" :
                  id === "light" ? "روشن و ساده" :
                  id === "minimal" ? "مینیمال" : "الهام‌بخش"}
              </small>
            </button>
          `).join("")}
        </div>
      `;

      target.appendChild(sectionEl);

      $$("[data-theme]", sectionEl).forEach(button => {
        button.addEventListener("click", () => {
          applyTheme(button.dataset.theme);
        });
      });

      const accentSection = document.createElement("div");
      accentSection.className = "setting-section";

      accentSection.innerHTML = `
        <h3>شخصی‌سازی بیشتر</h3>
        <p>انتخاب تم روی کل رابط اعمال می‌شود.</p>
        <div class="action-row">
          <button class="secondary-action" id="resetTheme">
            بازگشت به تم پیش‌فرض
          </button>
        </div>
      `;

      target.appendChild(accentSection);

      $("#resetTheme", target)?.addEventListener("click", () => {
        applyTheme("cherry");
      });

    } else if (section === "account") {
      const user = currentUser();

      target.insertAdjacentHTML("beforeend", `
        <div class="setting-section">
          <div class="setting-row">
            <div>
              <strong>نام کاربری</strong>
              <small>${escapeHtml(user.username || "نامشخص")}</small>
            </div>
          </div>

          <div class="setting-row">
            <div>
              <strong>شناسه حساب</strong>
              <small>${escapeHtml(user.id || "—")}</small>
            </div>
          </div>

          <div class="action-row">
            <button class="secondary-action" id="logoutBtn">
              خروج از حساب
            </button>
          </div>
        </div>
      `);

      $("#logoutBtn", target)?.addEventListener("click", () => {
        if (!confirm("از حساب VIANA خارج می‌شوی؟")) return;

        localStorage.removeItem("securityChatToken");
        localStorage.removeItem("securityChatUser");

        location.replace("login.html");
      });

    } else if (section === "notifications") {

      const settings = getNotificationSettings();

      if (settings.enabled === undefined) settings.enabled = true;
      if (!settings.sound) settings.sound = "soft";
      if (settings.volume === undefined) settings.volume = 0.45;

      const sounds = [
        ["classic", "Classic", "کلاسیک"],
        ["soft", "Soft", "ملایم"],
        ["digital", "Digital", "دیجیتالی"],
        ["pop", "Pop", "کوتاه و جذاب"],
        ["crystal", "Crystal", "شفاف و لطیف"],
        ["luxury", "Luxury", "خاص و شیک"]
      ];

      const sectionEl = document.createElement("div");
      sectionEl.className = "setting-section";

      sectionEl.innerHTML = `
        <h3>تنظیمات صدای اعلان</h3>
        <p>صدای دلخواهت را برای پیام‌های جدید انتخاب کن.</p>

        <div class="setting-row">
          <div>
            <strong>صدای اعلان</strong>
            <small>پخش صدا هنگام دریافت پیام جدید</small>
          </div>
          <button type="button" id="soundEnabled"
            class="toggle ${settings.enabled ? "on" : ""}"
            aria-label="فعال یا غیرفعال کردن صدای اعلان">
          </button>
        </div>

        <h3>انتخاب صدا</h3>

        <div class="viana-sound-list">
          ${sounds.map(([id, name, description]) => `
            <div class="viana-sound-option">
              <div>
                <strong>${name}</strong>
                <small>${description}</small>
              </div>
              <div>
                <button type="button"
                  class="secondary-action sound-preview"
                  data-sound="${id}">
                  ▶ پخش
                </button>
                <button type="button"
                  class="sound-select ${settings.sound === id ? "active" : ""}"
                  data-select-sound="${id}">
                  ${settings.sound === id ? "✓ انتخاب شده" : "انتخاب"}
                </button>
              </div>
            </div>
          `).join("")}
        </div>

        <h3>میزان بلندی صدا</h3>

        <div class="viana-volume">
          <span>کم</span>
          <input type="range" id="notificationVolume"
            min="0" max="100"
            value="${Math.round(settings.volume * 100)}">
          <span>زیاد</span>
          <b id="volumeValue">
            ${Math.round(settings.volume * 100)}٪
          </b>
        </div>
      `;

      target.appendChild(sectionEl);

      $("#soundEnabled", target)?.addEventListener("click", event => {
        settings.enabled = !settings.enabled;

        event.currentTarget.classList.toggle(
          "on",
          settings.enabled
        );

        saveNotificationSettings(settings);

        toast(
          settings.enabled
            ? "صدای اعلان فعال شد 🔔"
            : "صدای اعلان خاموش شد."
        );
      });

      $$("[data-select-sound]", target).forEach(button => {
        button.addEventListener("click", async () => {
          settings.sound = button.dataset.selectSound;
          saveNotificationSettings(settings);

          $$("[data-select-sound]", target).forEach(item => {
            const active =
              item.dataset.selectSound === settings.sound;

            item.classList.toggle("active", active);
            item.textContent = active ? "✓ انتخاب شده" : "انتخاب";
          });

          await playNotificationSound();
          toast("صدای اعلان انتخاب شد.");
        });
      });

      $$(".sound-preview", target).forEach(button => {
        button.addEventListener("click", async () => {
          settings.sound = button.dataset.sound;
          saveNotificationSettings(settings);
          await playNotificationSound();
        });
      });

      $("#notificationVolume", target)?.addEventListener(
        "input",
        event => {
          settings.volume = Number(event.target.value) / 100;

          $("#volumeValue", target).textContent =
            `${event.target.value}٪`;

          saveNotificationSettings(settings);
        }
      );

    } else if (section === "icons") {
      const packs = [
        ["classic", "✦ ◈ ◎", "کلاسیک"],
        ["rounded", "● ◆ ♡", "گرد و نرم"],
        ["minimal", "＋ − ×", "مینیمال"],
        ["nature", "✿ ❀ ❋", "طبیعت"]
      ];

      const grid = document.createElement("div");
      grid.className = "icon-packs";

      packs.forEach(([id, art, label]) => {
        const button = document.createElement("button");

        button.className =
          `icon-pack ${localStorage.getItem("vianaIconPack") === id ? "active" : ""}`;

        button.innerHTML = `
          <span class="pack-art">${art}</span>
          <b>${label}</b>
          <small>مجموعه آیکون</small>
        `;

        button.addEventListener("click", () => {
          localStorage.setItem("vianaIconPack", id);

          $$(".icon-pack", grid).forEach(item => {
            item.classList.remove("active");
          });

          button.classList.add("active");

          toast(`مجموعه ${label} انتخاب شد.`);
        });

        grid.appendChild(button);
      });

      target.appendChild(grid);

    } else {
      const note = document.createElement("div");
      note.className = "setting-section";

      note.innerHTML = `
        <h3>وضعیت این بخش</h3>
        <p>
          رابط این گزینه آماده است؛ اتصال تنظیمات پیشرفته به سرور
          در مرحله بعد انجام می‌شود.
        </p>

        <div class="setting-row">
          <div>
            <strong>فعال‌سازی روی همین دستگاه</strong>
            <small>این گزینه فقط در مرورگر ذخیره می‌شود.</small>
          </div>

          <button class="toggle" type="button"
            aria-label="تغییر وضعیت"></button>
        </div>
      `;

      const toggle = $(".toggle", note);
      const key = `vianaSetting_${section}`;

      toggle.classList.toggle(
        "on",
        localStorage.getItem(key) === "true"
      );

      toggle.addEventListener("click", () => {
        const value = !toggle.classList.contains("on");

        toggle.classList.toggle("on", value);

        localStorage.setItem(key, String(value));
      });

      target.appendChild(note);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  $$(".settings-link").forEach(button => {
    button.addEventListener("click", () => {
      openSettingsSection(button.dataset.setting);
    });
  });

  $("#quickTheme")?.addEventListener("click", () => {
    const index = themes.findIndex(
      item => item[0] === document.body.dataset.theme
    );

    applyTheme(themes[(index + 1) % themes.length][0]);

    toast("تم VIANA تغییر کرد.");
  });

  openSettingsSection("appearance");

  // -------- مارکت --------

  $$(".market-cat").forEach(button => {
    button.addEventListener("click", () => {
      const category = button.dataset.marketFilter;

      $$(".market-cat").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      $$(".product-card").forEach(card => {
        card.hidden =
          category !== "all" &&
          card.dataset.category !== category;
      });
    });
  });

  $$("[data-market-filter='all']").forEach(button => {
    if (!button.classList.contains("market-cat")) {
      button.addEventListener("click", () => {
        showPage("market");

        $$(".market-cat")
          .find(item => item.dataset.marketFilter === "all")
          ?.click();
      });
    }
  });

  $$(".heart-btn").forEach(button => {
    button.addEventListener("click", () => {
      button.classList.toggle("liked");

      button.textContent = button.classList.contains("liked")
        ? "♥"
        : "♡";

      toast(
        button.classList.contains("liked")
          ? "به علاقه‌مندی‌ها اضافه شد."
          : "از علاقه‌مندی‌ها حذف شد."
      );
    });
  });

  $$(".add-cart").forEach(button => {
    button.addEventListener("click", () => {
      state.cartCount++;

      toast(`به سبد خرید نمایشی اضافه شد · ${state.cartCount} کالا`);
    });
  });

  // -------- World و اعلان‌ها --------

  $$("#page-world button, .seller-banner button, .section-title .text-action, .notification-btn")
    .forEach(button => {

      if (button.classList.contains("notification-btn")) {
        button.addEventListener("click", enableNotifications);
      } else {
        button.addEventListener("click", () => {
          toast("این بخش در نسخه بعدی تکمیل می‌شود.");
        });
      }
    });

  // -------- شروع برنامه --------

  getSavedContacts().forEach(contact => {
    makeContactItem(contact);
  });

  renderChatList();

  if (token()) {
    api("/auth/me")
      .then(data => {
        if (data.user) {
          localStorage.setItem(
            "securityChatUser",
            JSON.stringify(data.user)
          );
        }
      })
      .catch(error => {
        console.warn("VIANA auth:", error.message);
      });
  }

  // بررسی پیام‌های جدید هر ۵ ثانیه
  // در پس‌زمینه نیز تلاش می‌کند بررسی را ادامه دهد.
  state.refreshTimer = setInterval(() => {
    if (!isRemote(state.activeContact)) return;

    loadConversation(state.activeContact).catch(error => {
      console.warn("VIANA refresh:", error.message);
    });
  }, 5000);

  // نمایش نام واقعی کاربر در قسمت بالای برنامه

  const user = currentUser();

  if (user.username) {
    const chip = $("#openMyProfile");

    if (chip) {
      const label = chip.querySelector("span:not(.my-avatar)");

      if (label) {
        label.textContent = user.username;
      }
    }
  }

})();
