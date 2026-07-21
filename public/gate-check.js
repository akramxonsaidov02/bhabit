// Prepended to kun-tartibim.html. Blocks the app for unapproved devices.
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
        // Viewer mode: lock all inputs / buttons via CSS + capture.
        if (data.device.role === "viewer") {
          var style = document.createElement("style");
          style.textContent =
            "html.bh-viewer button:not([data-bh-viewer-allow]), " +
            "html.bh-viewer input, html.bh-viewer textarea, html.bh-viewer select { pointer-events:none !important; opacity:.85; }" +
            "html.bh-viewer::before { content:'👁 Faqat ko\\27 ruvchi rejimi'; position:fixed; top:0; left:0; right:0; background:#57534e; color:#fff; text-align:center; padding:6px 12px; font:600 12px system-ui; z-index:99999; }";
          document.documentElement.appendChild(style);
          document.documentElement.classList.add("bh-viewer");
        }
        window.__BH_DEVICE__ = data.device;
      })
      .catch(function () {
        // Network error — allow through so a bad server doesn't lock the owner out.
      });
  } catch (e) { /* noop */ }
})();
