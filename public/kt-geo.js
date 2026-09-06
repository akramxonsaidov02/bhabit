// Kun Tartibim — GPS "yetib keldim" (geofence) → server → vazifa avtomatik belgilanadi + Telegram.
// Places are saved locally in S.geoPlaces = { "RTM": {lat,lng}, "Maktab": {lat,lng} }.
// Background: brauzer ilova ochiq/fonda bo'lsa ishlaydi. Ekran o'chmasligi uchun Wake Lock ishlatiladi,
// fon → old plan qaytganda kuzatuv qayta tiklanadi. Butunlay yopiq holatda brauzer GPS bermaydi.
(function () {
  const RADIUS_M = 150;
  let watchId = null;
  let wakeLock = null;
  let last = null; // {lat,lng,acc,at}
  const inside = {}; // place -> bool

  function tok() { return localStorage.getItem("bh_device_token") || ""; }
  function S() { return window.S || {}; }
  function places() { return S().geoPlaces || {}; }

  function dist(a, b) {
    const R = 6371000, toR = (x) => (x * Math.PI) / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  async function report(place, lat, lng) {
    if (!tok()) { toast("📍 " + place + " — yetib keldingiz"); return; }
    try {
      const r = await fetch("/api/public/gate/location-event", {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-token": tok() },
        body: JSON.stringify({ place, lat, lng }),
      });
      const d = await r.json().catch(() => ({}));
      if (d && d.autoDone) {
        const s = S();
        const t = (s.tasks || []).find((x) => String(x.id) === String(d.autoDone.id));
        if (t && !t.done && typeof markTaskDone === "function") markTaskDone(t.id);
        toast("📍 " + place + " — «" + d.autoDone.name + "» avtomatik belgilandi ✅");
      } else if (!d || !d.duplicate) {
        toast("📍 " + place + " — yetib keldingiz");
      }
      try { window.KTPush && KTPush.pollInbox && KTPush.pollInbox(); } catch (e) {}
    } catch (e) {}
  }

  function onPos(pos) {
    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    last = { lat: here.lat, lng: here.lng, acc: Math.round(pos.coords.accuracy || 0), at: Date.now() };
    const P = places();
    Object.keys(P).forEach((name) => {
      const d = dist(here, P[name]);
      const now = d <= RADIUS_M;
      if (now && !inside[name]) report(name, here.lat, here.lng);
      inside[name] = now;
    });
    const el = document.getElementById("ktGeoStatus");
    if (el) el.textContent = statusText();
  }

  function statusText() {
    if (watchId == null) return "Kuzatuv o‘chiq";
    if (!last) return "GPS qidirilmoqda…";
    const P = places();
    const near = Object.keys(P).map((n) => [n, Math.round(dist(last, P[n]))]).sort((a, b) => a[1] - b[1])[0];
    return "Faol · ±" + last.acc + " m" + (near ? " · " + near[0] + "gacha " + (near[1] >= 1000 ? (near[1] / 1000).toFixed(1) + " km" : near[1] + " m") : "");
  }

  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && !wakeLock && !document.hidden) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
      }
    } catch (e) {}
  }

  function startWatch() {
    if (watchId != null) return;
    watchId = navigator.geolocation.watchPosition(onPos, () => toast("GPS ruxsat kerak"), { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
  }

  function start(silent) {
    if (!navigator.geolocation) { toast("GPS mavjud emas"); return false; }
    if (!Object.keys(places()).length) { toast("Avval joy saqlang"); return false; }
    startWatch();
    S().geoOn = true; window.persist && persist();
    keepAwake();
    if (!silent) toast("📍 GPS kuzatuv yoqildi");
    return true;
  }
  function stop() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null; last = null;
    try { wakeLock && wakeLock.release(); } catch (e) {}
    wakeLock = null;
    S().geoOn = false; window.persist && persist();
  }

  // Resume after the tab/PWA comes back from background (browsers pause watchers there).
  document.addEventListener("visibilitychange", () => {
    if (!S().geoOn) return;
    if (!document.hidden) {
      if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      startWatch(); keepAwake();
      checkNow(true);
    }
  });

  // One-shot check (used on resume and by the "Hozir tekshirish" button).
  function checkNow(silent) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { onPos(pos); if (!silent) toast("📍 " + statusText()); },
      () => { if (!silent) toast("GPS ruxsat kerak"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }

  function savePlace(name) {
    if (!navigator.geolocation) { toast("GPS mavjud emas"); return; }
    toast("📡 Joy aniqlanmoqda…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const s = S();
        s.geoPlaces = Object.assign({}, s.geoPlaces, { [name]: { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) } });
        inside[name] = true; // we're standing here — don't fire an arrival immediately
        window.persist && persist();
        toast("✅ " + name + " joyi saqlandi");
        try { renderSettings && renderSettings(); } catch (e) {}
      },
      () => toast("GPS ruxsat kerak"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  function removePlace(name) {
    const s = S(); if (s.geoPlaces) delete s.geoPlaces[name];
    delete inside[name];
    window.persist && persist();
    try { renderSettings && renderSettings(); } catch (e) {}
  }

  async function history() {
    if (!tok()) return [];
    try {
      const r = await fetch("/api/public/gate/location-events", { headers: { "x-device-token": tok() } });
      const d = await r.json();
      return d.events || [];
    } catch (e) { return []; }
  }

  async function showHistory() {
    const ev = await history();
    const body = ev.length
      ? ev.map((e) => { const d = new Date(e.arrived_at); return "📍 " + e.place + " — " + d.toLocaleDateString("uz") + " " + d.toTimeString().slice(0, 5); }).join("\n")
      : "Hali yozuv yo‘q";
    alert("Yetib kelish tarixi:\n\n" + body);
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  function settingsHtml() {
    const P = places();
    const names = Object.keys(P);
    const rows = names.map((n) => {
      const safe = n.replace(/['"\\]/g, "");
      return `<div class="st-row"><span>📍 <b>${esc(n)}</b><br><small style="color:var(--tx3);font-weight:400">${P[n].lat}, ${P[n].lng}</small></span>
        <div class="st-btns"><button onclick="KTGeo.savePlace('${safe}')" title="Hozirgi joyga yangilash">↻</button><button onclick="if(confirm('${safe} o‘chirilsinmi?'))KTGeo.removePlace('${safe}')" title="O‘chirish">🗑</button></div></div>`;
    }).join("");
    const quick = ["RTM", "Maktab", "Uy"].filter((n) => !P[n]).map((n) => `<button onclick="KTGeo.savePlace('${n}')">＋ ${n}</button>`).join("");
    return `
      <div class="st-row"><span><b>GPS kuzatuv</b><br><small style="color:var(--tx3);font-weight:400">${RADIUS_M} m ichiga kirganda vazifa avtomatik ✅ va Telegramga xabar</small></span>
        <input type="checkbox" ${S().geoOn ? "checked" : ""} onchange="this.checked?KTGeo.start()||(this.checked=false):KTGeo.stop()"></div>
      <div class="st-row"><span id="ktGeoStatus" style="color:var(--tx2);font-size:12px">${statusText()}</span>
        <div class="st-btns"><button onclick="KTGeo.checkNow()">🎯 Hozir tekshirish</button><button onclick="KTGeo.showHistory()">🕓 Tarix</button></div></div>
      ${rows || '<div class="st-row"><small style="color:var(--tx3)">Hali joy saqlanmagan. Kerakli joyda turib tugmani bosing.</small></div>'}
      <div class="st-row" style="border-top:1px solid var(--bdr)"><span style="font-size:12px;color:var(--tx2)">Yangi joy (hozirgi o‘rningiz)</span>
        <div class="st-btns">${quick}<button onclick="var n=prompt('Joy nomi');if(n)KTGeo.savePlace(n.slice(0,30).replace(/['&quot;\\\\]/g,''))">＋ Boshqa</button></div></div>
      <div class="st-note">ℹ️ Fonda ishlashi: ilova ochiq yoki fonda bo‘lsa GPS ishlaydi (ekran qulflansa ham, agar ilova «Bosh ekranga» qo‘shilgan bo‘lsa). Butunlay yopib qo‘yilsa brauzer GPS bermaydi — bu brauzer cheklovi.</div>`;
  }

  function toast(m) { try { window.toast ? window.toast(m) : console.log(m); } catch (e) {} }

  window.KTGeo = { start, stop, checkNow, savePlace, removePlace, history, showHistory, settingsHtml, statusText };
  window.addEventListener("load", () => { setTimeout(() => { if (S().geoOn && Object.keys(places()).length) start(true); }, 2500); });
})();
