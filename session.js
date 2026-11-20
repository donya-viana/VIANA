
(() => {
  "use strict";

  const API_URL = "http://127.0.0.1:8000";
  const token = localStorage.getItem("securityChatToken");

  // اگر کاربر وارد نشده باشد
  if (!token) {
    window.location.replace("login.html");
    return;
  }

  // بررسی اعتبار توکن از طریق سرور
  fetch(`${API_URL}/auth/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error("SESSION_EXPIRED");
      }

      return await response.json();
    })
    .then(data => {
      const user = data.user;

      localStorage.setItem(
        "securityChatUser",
        JSON.stringify(user)
      );

      // نمایش نام کاربری واقعی
      const profileName = document.querySelector(".settings-user h3");
      if (profileName) {
        profileName.textContent = user.username;
      }

      const profileChip = document.querySelector(".profile-chip");
      if (profileChip) {
        profileChip.textContent = user.username;
      }
    })
    .catch(() => {
      localStorage.removeItem("securityChatToken");
      localStorage.removeItem("securityChatUser");
      window.location.replace("login.html");
    });
})();
