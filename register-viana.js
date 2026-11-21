(() => {
  "use strict";
const API_URL = "https://viana-api.onrender.com";
  const $ = id => document.getElementById(id);
  const form = $("registerForm");
  const button = $("registerBtn");
  const message = $("formMessage");
  let captchaValue = "";
  let busy = false;

  function showMessage(text, success = false) {
    message.textContent = text;
    message.classList.toggle("success", success);
    message.classList.toggle("error", !success && Boolean(text));
  }
  function makeCaptcha() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint32Array(5);
    crypto.getRandomValues(values);
    captchaValue = Array.from(values, n => chars[n % chars.length]).join("");
    $("captchaCode").textContent = captchaValue;
    $("captchaInput").value = "";
  }
  function setBusy(value) {
    busy = value;
    button.disabled = value;
    button.classList.toggle("loading", value);
    button.querySelector(".btn-label").textContent = value ? "در حال ساخت حساب..." : "ساخت حساب";
  }
  async function register(payload) {
    let response;
    try {
      response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (_) {
      throw new Error("به سرور وصل نشدیم. سرور پایتون را روشن کن و آدرس API را بررسی کن.");
    }
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { detail: raw }; }
    if (!response.ok) {
      let detail = data.detail || data.message || `خطای سرور (${response.status})`;
      if (Array.isArray(detail)) detail = detail.map(x => x.msg || "اطلاعات نامعتبر").join("، ");
      if (response.status === 409) detail = "این نام کاربری قبلاً ثبت شده است؛ نام دیگری انتخاب کن.";
      if (response.status === 404) detail = "مسیر ثبت‌نام در سرور پیدا نشد؛ مسیر /auth/register را در FastAPI بررسی کن.";
      throw new Error(detail);
    }
    return data;
  }

  $("refreshCaptcha").addEventListener("click", makeCaptcha);
  document.querySelectorAll("[data-toggle]").forEach(buttonEl => buttonEl.addEventListener("click", () => {
    const field = $(buttonEl.dataset.toggle);
    const reveal = field.type === "password";
    field.type = reveal ? "text" : "password";
    buttonEl.textContent = reveal ? "مخفی" : "نمایش";
  }));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    showMessage("");
    const username = $("registerName").value.trim();
    const password = $("registerPassword").value;
    const confirmation = $("confirmPassword").value;
    const captcha = $("captchaInput").value.trim().toUpperCase();
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) return showMessage("نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی، عدد، نقطه یا زیرخط باشد.");
    if (password.length < 8 || password.length > 128) return showMessage("رمز عبور باید بین ۸ تا ۱۲۸ کاراکتر باشد.");
    if (password !== confirmation) return showMessage("تکرار رمز عبور با رمز اصلی یکسان نیست.");
    if (!captcha) return showMessage("کد امنیتی را وارد کن.");
    if (captcha !== captchaValue) { makeCaptcha(); return showMessage("کد امنیتی اشتباه است؛ کد تازه را وارد کن."); }
    if (!$("acceptPolicy").checked) return showMessage("برای ادامه باید قوانین و حریم خصوصی را بپذیری.");

    setBusy(true);
    try {
      // Match the existing FastAPI RegisterData model exactly.
      const data = await register({ username, password });
      if (!data.user) throw new Error("حساب ساخته شد اما پاسخ کاربر از سرور دریافت نشد.");
      showMessage("حساب کاربری با موفقیت ساخته شد. در حال انتقال به صفحه ورود...", true);
      form.reset();
      makeCaptcha();
      window.setTimeout(() => { window.location.href = "login.html"; }, 1000);
    } catch (error) {
      showMessage(error.message || "ثبت‌نام انجام نشد.");
      makeCaptcha();
    } finally { setBusy(false); }
  });
  makeCaptcha();
})();
