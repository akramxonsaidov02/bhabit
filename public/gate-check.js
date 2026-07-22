// Prepended to kun-tartibim.html. Enforces gate rules for the running app.
(function () {
  try {
    var token = localStorage.getItem("bh_device_token");
    if (!token) {
      window.location.replace("/");
      return;
    }
    fetch("/api/public/gate/status", { headers: { "x-device-token": token } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.device) {
          localStorage.removeItem("bh_device_token");
          window.location.replace("/");
          return;
        }
        window.__BH_DEVICE__ = data.device;
        // Viewer mode: fully interactive UI, but persistence is disabled.
        // Actual write-blocking is enforced inside kt-cloud.js via window.__BH_VIEWER__.
        if (data.device.role === "viewer") {
          window.__BH_VIEWER__ = true;
          var style = document.createElement("style");
          style.textContent =
            "html.bh-viewer::before { content:'\\1F441 Faqat ko\\27 ruvchi rejimi \\2014 o\\27 zgarishlar saqlanmaydi'; " +
            "position:fixed; top:0; left:0; right:0; background:#57534e; color:#fff; text-align:center; " +
            "padding:6px 12px; font:600 12px system-ui; z-index:99999; letter-spacing:.02em; }" +
            "html.bh-viewer body { padding-top:28px !important; }";
          document.documentElement.appendChild(style);
          document.documentElement.classList.add("bh-viewer");
        }
      })
      .catch(function () {
        // Network error — allow through so a bad server doesn't lock the owner out.
      });
  } catch (e) { /* noop */ }
})();
