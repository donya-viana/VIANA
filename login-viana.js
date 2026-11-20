
(() => {
  "use strict";

  const API_URL = "http://127.0.0.1:8000";
  const $ = id => document.getElementById(id);

  const form = $("loginForm");
  const button = $("loginBtn");
  const message = $("loginMessage");

  let captchaValue = "";
  let busy = false;

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
  }

  function makeCaptcha() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint32Array(5);

    crypto.getRandomValues(values);

    captchaValue = Array.from(
      values,
      n => chars[n % chars.length]
    ).join("");

    $("captchaCode").textContent = captchaValue;
    $("captchaAnswer").value = "";
  }

  function setBusy(value) {
    busy = value;
    button.disabled = value;
    button.querySelector(".btn-label").textContent =
      value ? "در حال بررسی..." : "ورود به حساب";
  }

  async function apiRequest(path, payload) {
    let response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (_) {
      throw new Error(
        "به سرور وصل نشدیم. سرور پایتون را روشن کن و آدرس API را بررسی کن."
      );
    }

    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { detail: raw };
    }

    if (!response.ok) {
      let detail =
        data.detail || data.message || `خطای سرور (${response.status})`;

      if (Array.isArray(detail)) {
        detail = detail.map(x => x.msg || "اطلاعات نامعتبر").join("، ");
      }

      if (response.status === 401) {
        detail = "نام کاربری یا رمز عبور اشتباه است.";
      }

      if (response.status === 404) {
        detail = "مسیر ورود در سرور پیدا نشد.";
      }

      throw new Error(detail);
    }

    return data;
  }

  $("refreshCaptcha").addEventListener("click", makeCaptcha);

  $("togglePassword").addEventListener("click", () => {
    const input = $("loginPassword");

    input.type =
      input.type === "password" ? "text" : "password";

    $("togglePassword").textContent =
      input.type === "password" ? "◉" : "◎";
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (busy) return;

    const username = $("loginName").value.trim();
    const password = $("loginPassword").value;
    const captcha = $("captchaAnswer").value.trim().toUpperCase();

    if (!username || !password) {
      return showMessage("نام کاربری و رمز عبور را وارد کن.");
    }

    if (username.length < 3) {
      return showMessage("نام کاربری باید حداقل ۳ کاراکتر باشد.");
    }

    if (!captcha) {
      return showMessage("کد امنیتی را وارد کن.");
    }

    if (captcha !== captchaValue) {
      makeCaptcha();
      return showMessage("کد امنیتی اشتباه است؛ کد تازه را وارد کن.");
    }

    if (!$("acceptPolicy").checked) {
      return showMessage("برای ادامه، قوانین و حریم خصوصی را تأیید کن.");
    }

    setBusy(true);
    showMessage("در حال اتصال به سرور ویانا...", "info");

    try {
      const data = await apiRequest("/auth/login", {
        username,
        password
      });

      if (!data.access_token || !data.user) {
        throw new Error("پاسخ سرور ناقص است؛ main.py را بررسی کن.");
      }

      localStorage.setItem("securityChatToken", data.access_token);
      localStorage.setItem(
        "securityChatUser",
        JSON.stringify(data.user)
      );

      showMessage("ورود موفق بود؛ در حال انتقال...", "success");

      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 600);

    } catch (error) {
      showMessage(error.message || "ورود انجام نشد.");
      makeCaptcha();

    } finally {
      setBusy(false);
    }
  });

  const modal = $("policyModal");

  document.querySelectorAll("[data-policy]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      const privacy = link.dataset.policy === "privacy";

      $("policyTitle").textContent = privacy
        ? "سیاست حریم خصوصی VIANA"
        : "قوانین استفاده از VIANA";

      $("policyText").textContent = privacy
        ? "اطلاعات حساب برای ارائه خدمات ویانا استفاده می‌شود. رمز عبور فقط به‌صورت هش‌شده در سرور ذخیره می‌شود."
        : "از ویانا برای فعالیت غیرقانونی، آزار دیگران یا نقض حقوق کاربران استفاده نکن.";

      modal.hidden = false;
    });
  });

  $("closePolicy").addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.hidden = true;
    }
  });

  $("forgotLink").addEventListener("click", event => {
    event.preventDefault();
    showMessage(
      "بازیابی رمز عبور هنوز به سرور متصل نشده است.",
      "info"
    );
  });

  makeCaptcha();

})();
