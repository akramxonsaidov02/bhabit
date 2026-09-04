// Kun Tartibim — GPS "yetib keldim" (geofence) → server → Telegram.
// Places are saved locally in S.geoPlaces = { "RTM": {lat,lng}, "Maktab": {lat,lng} }.
(function () {
  const RADIUS_M = 150;
  let watchId = null;
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
    if (!tok()) return;
    try {
      await fetch("/api/public/gate/location-event", {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-token": tok() },
        body: JSON.stringify({ place, lat, lng }),
      });
      toast("📍 " + place + " — yetib keldingiz");
    } catch (e) {}
  }

  function onPos(pos) {
    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const P = places();
    Object.keys(P).forEach((name) => {
      const d = dist(here, P[name]);
      const now = d <= RADIUS_M;
      if (now && !inside[name]) report(name, here.lat, here.lng);
      inside[name] = now;
    });
  }

  function start() {
    if (!navigator.geolocation) { toast("GPS mavjud emas"); return false; }
    if (watchId != null) return true;
    if (!Object.keys(places()).length) { toast("Avval joy saqlang"); return false; }
    watchId = navigator.geolocation.watchPosition(onPos, () => toast("GPS ruxsat kerak"), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
    S().geoOn = true; window.persist && persist();
    toast("📍 GPS kuzatuv yoqildi");
    return true;
  }
  function stop() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    S().geoOn = false; window.persist && persist();
  }

  function savePlace(name) {
    if (!navigator.geolocation) { toast("GPS mavjud emas"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const s = S();
        s.geoPlaces = Object.assign({}, s.geoPlaces, { [name]: { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) } });
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

  function settingsHtml() {
    const P = places();
    const rows = Object.keys(P).map((n) =>
      `<div class="st-row"><span>📍 ${n}<br><small style="color:var(--tx3)">${P[n].lat}, ${P[n].lng}</small></span><button class="st-btn" onclick="KTGeo.removePlace('${n.replace(/'/g, "")}')">🗑</button></div>`,
    ).join("");
    return `
      <div class="st-row"><span><b>GPS kuzatuv</b><br><small style="color:var(--tx3);font-weight:400">${RADIUS_M} m radiusga kirganda Telegramga "yetib keldim" yuboriladi</small></span>
        <input type="checkbox" ${S().geoOn ? "checked" : ""} onchange="this.checked?KTGeo.start()||(this.checked=false):KTGeo.stop()"></div>
      ${rows}
      <div class="st-btns" style="margin-top:8px">
        <button onclick="KTGeo.savePlace('RTM')">＋ RTM (hozirgi joy)</button>
        <button onclick="KTGeo.savePlace('Maktab')">＋ Maktab</button>
        <button onclick="KTGeo.savePlace('Uy')">＋ Uy</button>
        <button onclick="var n=prompt('Joy nomi');if(n)KTGeo.savePlace(n.slice(0,30))">＋ Boshqa</button>
      </div>`;
  }

  function toast(m) { try { window.toast ? window.toast(m) : console.log(m); } catch (e) {} }

  window.KTGeo = { start, stop, savePlace, removePlace, history, settingsHtml };
  window.addEventListener("load", () => { setTimeout(() => { if (S().geoOn && Object.keys(places()).length) start(); }, 2500); });
})();
