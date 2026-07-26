// ═══════════════════════════════════════════════════════════════
// KT EXTRAS — 1-bosqich funksiyalari
// Barchasi Sozlamalar → "Qo'shimcha funksiyalar" da On/Off qilinadi
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  const MARGILON = { lat: 40.4715, lon: 71.7243, name: "Marg'ilon" };

  // ---------- Sozlamalar bo'limi HTML (renderSettings ichiga qo'shiladi) ----------
  function settingsSection(S){
    S.extras = S.extras || {};
    const e = S.extras;
    const row = (key, label, sub, def=true) => {
      const on = e[key] !== undefined ? e[key] : def;
      return `<div class="st-row"><span>${label}${sub?`<br><small style="color:var(--tx3);font-weight:400">${sub}</small>`:''}</span>
        <input type="checkbox" ${on?'checked':''} onchange="KTExtras.toggle('${key}',this.checked)"></div>`;
    };
    return `
    <div class="st-sec"><h4>✨ Qo'shimcha funksiyalar</h4>
      ${row('weather','🌤️ Ob-havo (Marg\'ilon)','Ertalabki brifing va yugurish taklifi')}
      ${row('briefing','☀️ Ertalabki brifing','Bugungi vazifalar + 1-namoz + ob-havo')}
      ${row('voiceAdd','🎤 Ovozli qo\'shish','Mikrofon tugmasi — aytib turing, AI vazifa yasaydi')}
      ${row('confetti','🎉 "Bugungi g\'alaba" ekrani','Barcha vazifa bajarilsa tabrik')}
      ${row('streakAnim','🔥 Streak animatsiyasi','Ketma-ket kunlar oshganda olov')}
      ${row('streakFreeze','❄️ Streak Freeze','Oyiga 2 marta kun o\'tkazsangiz zanjir uzilmaydi')}
      ${row('badges','🏆 Yutuq nishonlari','30/100/365 kunlik zanjirlar')}
      ${row('hotkeys','⌨️ Klaviatura buyruqlari','N=yangi, F=qidiruv, /=sozlama')}
      ${row('templates','📋 Tayyor shablonlar','Talaba / Hofiz / Sportchi kun tartibi')}
      <div class="st-row"><span>🧠 AI haftalik hisobot</span>
        <button onclick="KTExtras.showReport()" style="background:rgba(var(--accent-rgb),.15);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);padding:6px 12px;border-radius:8px;font-weight:600;cursor:pointer">Ochish</button>
      </div>
      <div class="st-row"><span>📋 Shablon import</span>
        <select class="st-sel" onchange="KTExtras.applyTemplate(this.value);this.value=''">
          <option value="">Tanlang…</option>
          <option value="student">🎓 Talaba</option>
          <option value="hafiz">📖 Hofiz</option>
          <option value="sport">💪 Sportchi</option>
        </select>
      </div>
      <div class="st-row"><span>🔔 Bugungi brifingni sinash</span>
        <button onclick="KTExtras.sendBriefingNow()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--bdr2);background:var(--glass-bg2);color:var(--tx);font-weight:600;cursor:pointer">Yuborish</button>
      </div>
    </div>`;
  }

  function toggle(key, on){
    try{
      window.S.extras = window.S.extras || {};
      window.S.extras[key] = on;
      window.persist && window.persist();
      applyFeatures();
      window.toast && window.toast(on ? '✅ Yoqildi' : '🚫 O\'chirildi');
      // FAB button holatini yangilash
      updateMicFab();
    }catch(e){}
  }

  function isOn(key, def=true){
    try{
      const v = window.S && window.S.extras && window.S.extras[key];
      return v === undefined ? def : !!v;
    }catch(e){ return def; }
  }

  function afterRenderSettings(){}

  // ---------- OB-HAVO (Open-Meteo, kalitsiz) ----------
  let weatherCache = null;
  async function fetchWeather(){
    if(!isOn('weather')) return null;
    if(weatherCache && Date.now() - weatherCache.at < 30*60*1000) return weatherCache.data;
    try{
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${MARGILON.lat}&longitude=${MARGILON.lon}&current=temperature_2m,weather_code,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Asia%2FTashkent&forecast_days=1`;
      const r = await fetch(url);
      if(!r.ok) return null;
      const d = await r.json();
      weatherCache = { at: Date.now(), data: d };
      return d;
    }catch(e){ return null; }
  }
  function wxIcon(code){
    if(code==null) return '🌤️';
    if(code===0) return '☀️';
    if(code<=3) return '⛅';
    if(code<=48) return '🌫️';
    if(code<=67) return '🌧️';
    if(code<=77) return '❄️';
    if(code<=82) return '🌧️';
    if(code<=99) return '⛈️';
    return '🌤️';
  }
  function wxIsRainy(d){
    if(!d) return false;
    const p = d.daily && d.daily.precipitation_sum && d.daily.precipitation_sum[0];
    const code = d.daily && d.daily.weather_code && d.daily.weather_code[0];
    return (p && p >= 1) || (code >= 51 && code <= 82);
  }
  async function weatherBanner(){
    const el = document.getElementById('ktWeatherBanner');
    if(!el) return;
    if(!isOn('weather')){ el.style.display='none'; return; }
    const d = await fetchWeather();
    if(!d){ el.style.display='none'; return; }
    const t = Math.round(d.current.temperature_2m);
    const code = d.current.weather_code;
    const max = Math.round(d.daily.temperature_2m_max[0]);
    const min = Math.round(d.daily.temperature_2m_min[0]);
    el.innerHTML = `<span style="font-size:20px">${wxIcon(code)}</span>
      <span><b>${t}°C</b> · ${MARGILON.name} · ${min}° / ${max}°</span>
      ${wxIsRainy(d)?'<span style="margin-left:auto;color:#60a5fa;font-size:11px">🌧️ Yomg\'ir kutilmoqda</span>':''}`;
    el.style.display='flex';
  }

  // ---------- ERTALABKI BRIFING ----------
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  async function maybeSendBriefing(){
    if(!isOn('briefing')) return;
    const S = window.S; if(!S) return;
    const last = S.extras.lastBriefing;
    if(last === todayStr()) return;
    const now = new Date();
    const [dh,dm] = (S.dayStart||'06:30').split(':').map(Number);
    // Faqat kun boshi ± 30 daq oralig'ida yuboradi
    const dayMin = dh*60+dm;
    const nowMin = now.getHours()*60+now.getMinutes();
    if(Math.abs(nowMin - dayMin) > 30) return;
    await sendBriefingNow(true);
  }
  async function sendBriefingNow(silent){
    const S = window.S; if(!S) return;
    const tasks = (S.tasks||[]).filter(t=>t.start);
    const w = await fetchWeather();
    const wxStr = w ? ` · ${wxIcon(w.current.weather_code)} ${Math.round(w.current.temperature_2m)}°C` : '';
    const nextPrayer = getNextPrayerLabel();
    const body = `📋 ${tasks.length} vazifa${nextPrayer?' · '+nextPrayer:''}${wxStr}`;
    try{
      if('Notification' in window && Notification.permission === 'granted'){
        new Notification('☀️ Bugungi brifing', { body, icon:'/favicon.ico', tag:'kt-briefing' });
      } else {
        window.toast && window.toast('☀️ '+body);
      }
      S.extras.lastBriefing = todayStr();
      window.persist && window.persist();
      if(!silent) window.toast && window.toast('✅ Brifing yuborildi');
    }catch(e){}
  }
  function getNextPrayerLabel(){
    const S = window.S; if(!S||!S.prayers) return '';
    const names = { fajr:'Bomdod', dhuhr:'Peshin', asr:'Asr', maghrib:'Shom', isha:'Xufton' };
    const now = new Date().getHours()*60+new Date().getMinutes();
    let next=null, nextTime=99999;
    for(const k of Object.keys(names)){
      const v = S.prayers[k]; if(!v) continue;
      const [h,m]=v.split(':').map(Number); const t=h*60+m;
      if(t>now && t<nextTime){ nextTime=t; next=`${names[k]} ${v}`; }
    }
    return next || '';
  }

  // ---------- OVOZLI QO'SHISH ----------
  function updateMicFab(){
    let fab = document.getElementById('ktMicFab');
    if(!isOn('voiceAdd', false)){ if(fab) fab.remove(); return; }
    if(fab) return;
    fab = document.createElement('button');
    fab.id='ktMicFab';
    fab.title='Ovozli qo\'shish';
    fab.innerHTML='🎤';
    fab.onclick = startVoice;
    document.body.appendChild(fab);
  }
  let rec=null, chunks=[], stream=null;
  async function startVoice(){
    const fab = document.getElementById('ktMicFab');
    if(rec && rec.state==='recording'){
      rec.stop();
      return;
    }
    try{
      if(!navigator.mediaDevices || !window.MediaRecorder){ window.toast && window.toast('❌ Mikrofon qo\'llanmaydi'); return; }
      stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      chunks=[];
      rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined });
      rec.ondataavailable = e=>{ if(e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async ()=>{
        if(fab){ fab.classList.remove('rec'); fab.innerHTML='🎤'; }
        try{ stream && stream.getTracks().forEach(t=>t.stop()); }catch(e){}
        const blob = new Blob(chunks, { type:'audio/webm' });
        await transcribeAndProcess(blob);
      };
      rec.start();
      if(fab){ fab.classList.add('rec'); fab.innerHTML='■'; }
      window.toast && window.toast('🎤 Gapiring, tugatish uchun yana bosing');
      setTimeout(()=>{ try{ if(rec && rec.state==='recording') rec.stop(); }catch(e){} }, 30000);
    }catch(e){
      if(fab){ fab.classList.remove('rec'); fab.innerHTML='🎤'; }
      window.toast && window.toast('❌ Mikrofon ruxsati kerak');
    }
  }
  async function transcribeAndProcess(blob){
    try{
      window.toast && window.toast('🧠 Ovoz tahlil qilinmoqda…');
      const fd = new FormData();
      fd.append('file', blob, 'voice.webm');
      const tr = await fetch('/api/voice-transcribe', { method:'POST', headers:{'x-device-token':localStorage.getItem('bh_device_token')||''}, body:fd });
      const tj = await tr.json();
      if(!tr.ok || !tj.ok || !tj.text) throw new Error(tj.error||'Transkripsiya xatosi');
      window.toast && window.toast('💭 '+tj.text);
      await processVoice(tj.text);
    }catch(e){ window.toast && window.toast('❌ '+(e.message||'Ovoz ishlamadi')); }
  }
  async function processVoice(transcript){
    try{
      const S = window.S;
      const r = await fetch('/api/ai-plan', {
        method:'POST', headers:{'Content-Type':'application/json','x-device-token':localStorage.getItem('bh_device_token')||''},
        body: JSON.stringify({ mode:'voice', transcript, dayStart:S.dayStart, sleep:S.sleepTime, prayers:S.prayers, tasks:S.tasks, now:new Date().toISOString() })
      });
      const j = await r.json();
      if(!j.ok){ window.toast && window.toast('❌ AI xatoligi'); return; }
      let data; try{ data = JSON.parse(j.content); }catch(e){
        const m = j.content.match(/\{[\s\S]*\}/); if(m) data = JSON.parse(m[0]);
      }
      if(!data || !data.action){ window.toast && window.toast('❌ Buyruq tushunilmadi'); return; }
      executeVoiceAction(data);
    }catch(e){ window.toast && window.toast('❌ '+e.message); }
  }
  function findTask(id){
    const S=window.S; if(!S||!S.tasks) return null;
    return S.tasks.find(t=>String(t.id)===String(id)||String(t.cloudId)===String(id));
  }
  function executeVoiceAction(data){
    const S = window.S; if(!S) return;
    if(data.action==='add' && data.task){
      const task = { id:Date.now(), name:data.task.name||'Yangi vazifa', start:data.task.start||'09:00', end:data.task.end||'10:00', cat:data.task.category||'other', priority:data.task.priority||'o\'rta', note:data.task.note||'', done:false, autoChecked:false, deferred:false };
      S.tasks = S.tasks || []; S.tasks.push(task);
      window.persist && window.persist();
      window.KTCloud && window.KTCloud.pushTaskChange && window.KTCloud.pushTaskChange(task);
      window.renderSchedule && window.renderSchedule();
      window.toast && window.toast('✅ '+(data.reply||('"'+task.name+'" qo\'shildi')));
      return;
    }
    const t = findTask(data.targetId);
    if(!t){ window.toast && window.toast(data.reply||'Mos vazifa topilmadi'); return; }
    if(data.action==='complete') t.done=true;
    else if(data.action==='uncomplete') t.done=false;
    else if(data.action==='delete') S.tasks=S.tasks.filter(x=>String(x.id)!==String(t.id)&&String(x.cloudId)!==String(t.cloudId));
    else { window.toast && window.toast(data.reply||'Buyruq tushunilmadi'); return; }
    window.persist && window.persist();
    if(data.action==='delete') window.KTCloud && window.KTCloud.deleteTaskCloud && window.KTCloud.deleteTaskCloud(t);
    else window.KTCloud && window.KTCloud.saveTaskCompletion && window.KTCloud.saveTaskCompletion(t,t.done);
    window.renderSchedule && window.renderSchedule();
    window.toast && window.toast('✅ '+(data.reply||'Bajarildi'));
  }

  // ---------- CONFETTI "BUGUNGI G'ALABA" ----------
  let victoryShown = null;
  function checkVictory(){
    if(!isOn('confetti')) return;
    const S = window.S; if(!S||!S.tasks||!S.tasks.length) return;
    const today = todayStr();
    if(victoryShown === today) return;
    const done = S.tasks.filter(t=>t.done).length;
    if(done === S.tasks.length && done >= 3){
      victoryShown = today;
      showVictory(done);
    }
  }
  function showVictory(count){
    fireConfetti();
    const streak = calcStreak();
    const div = document.createElement('div');
    div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .3s';
    div.innerHTML=`<div style="text-align:center;color:#fff;padding:40px">
      <div style="font-size:80px;animation:pulse 1s infinite">🏆</div>
      <h2 style="font-size:32px;margin:16px 0;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Ajoyib!</h2>
      <p style="font-size:18px;opacity:.9;margin-bottom:8px">Bugungi barcha <b>${count}</b> ta vazifa bajarildi!</p>
      ${streak>1?`<p style="font-size:16px;color:#fbbf24">🔥 ${streak} kunlik zanjir!</p>`:''}
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top:24px;padding:12px 32px;border-radius:12px;border:none;background:#22c55e;color:#000;font-weight:700;font-size:16px;cursor:pointer">Rahmat! 🎉</button>
    </div>`;
    document.body.appendChild(div);
    setTimeout(()=>div.remove(), 10000);
  }
  function fireConfetti(){
    const c = document.getElementById('ktConfetti'); if(!c) return;
    c.style.display='block'; c.width=innerWidth; c.height=innerHeight;
    const ctx = c.getContext('2d');
    const colors = ['#22c55e','#3b82f6','#a78bfa','#f59e0b','#ef4444','#ec4899','#fbbf24'];
    const parts = [];
    for(let i=0;i<150;i++) parts.push({
      x: Math.random()*innerWidth, y: -20,
      vx: (Math.random()-.5)*8, vy: Math.random()*4+2,
      r: Math.random()*8+4, c: colors[Math.random()*colors.length|0],
      rot: Math.random()*360, vr: (Math.random()-.5)*10
    });
    let frame=0;
    (function tick(){
      ctx.clearRect(0,0,c.width,c.height);
      parts.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.vy+=.15; p.rot+=p.vr;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle=p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r);
        ctx.restore();
      });
      frame++;
      if(frame<200) requestAnimationFrame(tick); else c.style.display='none';
    })();
  }

  // ---------- STREAK ----------
  function calcStreak(){
    const S = window.S; if(!S) return 0;
    const h = S.dayHistory || {};
    let streak = 0;
    const d = new Date();
    for(let i=0;i<400;i++){
      const k = d.toISOString().slice(0,10);
      const e = h[k];
      if(e && e.done>0 && e.done >= Math.max(1,e.total*0.7)) streak++;
      else if(i>0) break;
      d.setDate(d.getDate()-1);
    }
    return streak;
  }

  // ---------- BADGES ----------
  function checkBadges(){
    if(!isOn('badges')) return;
    const S = window.S; if(!S) return;
    S.extras.badges = S.extras.badges || [];
    const s = calcStreak();
    const tiers = [7,30,100,365];
    for(const t of tiers){
      if(s>=t && !S.extras.badges.includes(t)){
        S.extras.badges.push(t);
        window.persist && window.persist();
        window.toast && window.toast('🏆 Yangi nishon: '+t+' kunlik zanjir!');
        fireConfetti();
      }
    }
  }

  // ---------- HOTKEYS ----------
  function initHotkeys(){
    document.addEventListener('keydown', (e)=>{
      if(!isOn('hotkeys')) return;
      const t = e.target;
      if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.isContentEditable)) return;
      if(e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if(k==='n'){ e.preventDefault(); window.openAddTask && window.openAddTask(); }
      else if(k==='f'){ e.preventDefault(); const s=document.querySelector('input[type=search],#searchInp'); if(s) s.focus(); else window.smartAddTask && window.smartAddTask(); }
      else if(k==='/'){ e.preventDefault(); window.openSettings && window.openSettings(); }
      else if(k==='escape'){
        document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open'));
      }
    });
  }

  // ---------- TAYYOR SHABLONLAR ----------
  const TEMPLATES = {
    student: [
      {name:'Uyg\'onish + tayyorlanish', start:'06:30', end:'07:00', cat:'morning'},
      {name:'Bomdod namozi', start:'05:00', end:'05:15', cat:'prayer'},
      {name:'Ertalabki nonushta', start:'07:00', end:'07:30', cat:'food'},
      {name:'Darslar (universitet/maktab)', start:'08:00', end:'13:00', cat:'work', priority:'yuqori'},
      {name:'Tushlik', start:'13:00', end:'13:30', cat:'food'},
      {name:'Uy vazifasi', start:'15:00', end:'17:00', cat:'work', priority:'yuqori'},
      {name:'Kitob o\'qish', start:'17:00', end:'18:00', cat:'other'},
      {name:'Kechki ovqat', start:'19:00', end:'19:30', cat:'food'},
      {name:'Ertangi kunga tayyorgarlik', start:'21:00', end:'21:30', cat:'other'},
      {name:'Uxlash', start:'22:30', end:'23:00', cat:'night'}
    ],
    hafiz: [
      {name:'Tahajjud', start:'04:00', end:'04:30', cat:'prayer', priority:'yuqori'},
      {name:'Bomdod namozi', start:'05:00', end:'05:15', cat:'prayer', priority:'yuqori'},
      {name:'Yangi juz yodlash', start:'05:30', end:'07:30', cat:'work', priority:'yuqori'},
      {name:'Nonushta', start:'08:00', end:'08:30', cat:'food'},
      {name:'Eski juzlarni takror', start:'09:00', end:'11:30', cat:'work', priority:'yuqori'},
      {name:'Peshin namozi', start:'12:30', end:'12:45', cat:'prayer'},
      {name:'Tushlik + dam', start:'13:00', end:'14:00', cat:'food'},
      {name:'Tafsir o\'qish', start:'14:30', end:'16:00', cat:'other'},
      {name:'Asr namozi', start:'16:00', end:'16:15', cat:'prayer'},
      {name:'Sabaqni ustozga topshirish', start:'17:00', end:'18:00', cat:'work'},
      {name:'Shom namozi', start:'18:00', end:'18:15', cat:'prayer'},
      {name:'Kechki ovqat', start:'19:00', end:'19:30', cat:'food'},
      {name:'Xufton namozi', start:'20:00', end:'20:15', cat:'prayer'},
      {name:'Erta uxlash', start:'21:30', end:'22:00', cat:'night'}
    ],
    sport: [
      {name:'Uyg\'onish', start:'05:30', end:'06:00', cat:'morning'},
      {name:'Bomdod', start:'05:00', end:'05:15', cat:'prayer'},
      {name:'Ertalabki yugurish (5 km)', start:'06:00', end:'06:45', cat:'sport', priority:'yuqori'},
      {name:'Protein nonushta', start:'07:00', end:'07:30', cat:'food'},
      {name:'Ish/o\'qish', start:'09:00', end:'13:00', cat:'work'},
      {name:'Tushlik', start:'13:00', end:'13:30', cat:'food'},
      {name:'Kuchli mashqlar (gym)', start:'17:00', end:'18:30', cat:'sport', priority:'yuqori'},
      {name:'Kechki ovqat', start:'19:30', end:'20:00', cat:'food'},
      {name:'Cho\'zilish + meditatsiya', start:'21:00', end:'21:30', cat:'other'},
      {name:'Uxlash', start:'22:00', end:'22:30', cat:'night'}
    ]
  };
  function applyTemplate(key){
    if(!key || !TEMPLATES[key]) return;
    if(!confirm('Tayyor shablon vazifalarga qo\'shiladi. Davom etamizmi?')) return;
    const S = window.S; if(!S) return;
    S.tasks = S.tasks || [];
    const now = Date.now();
    TEMPLATES[key].forEach((t,i)=>{
      const task = { id: now+i, name:t.name, start:t.start, end:t.end, cat:t.cat, priority:t.priority||'o\'rta', done:false };
      S.tasks.push(task);
      window.KTCloud && window.KTCloud.pushTaskChange && window.KTCloud.pushTaskChange(task);
    });
    window.persist && window.persist();
    try{ window.renderSchedule && window.renderSchedule(); }catch(e){}
    window.toast && window.toast('✅ '+TEMPLATES[key].length+' vazifa qo\'shildi');
  }

  // ---------- AI HAFTALIK HISOBOT ----------
  async function showReport(){
    const S = window.S; if(!S) return;
    const modal = document.createElement('div');
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML=`<div style="background:var(--bg,#0f172a);border:1px solid var(--bdr,#334155);border-radius:16px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;padding:24px;color:var(--tx,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px">🧠 AI Haftalik hisobot</h3>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;color:var(--tx);font-size:24px;cursor:pointer">✕</button>
      </div>
      <div id="ktReportBody" style="line-height:1.7">
        <div style="text-align:center;padding:40px"><div style="display:inline-block;width:20px;height:20px;border:2px solid var(--accent,#22c55e);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></div><div style="margin-top:12px;color:var(--tx2)">AI tahlil qilmoqda…</div></div>
      </div>
    </div>`;
    document.body.appendChild(modal);

    // Ma'lumot yig'ish
    const h = S.dayHistory || {};
    const days = 7;
    const summary = { period:days+' kun', streak:calcStreak(), byDay:{}, byCategory:{} };
    const d = new Date();
    for(let i=0;i<days;i++){
      const k = d.toISOString().slice(0,10);
      summary.byDay[k] = h[k] || {done:0,total:0};
      d.setDate(d.getDate()-1);
    }
    (S.tasks||[]).forEach(t=>{
      const c = t.cat||'other';
      summary.byCategory[c] = (summary.byCategory[c]||0)+1;
    });

    try{
      const r = await fetch('/api/ai-plan', {
        method:'POST', headers:{'Content-Type':'application/json','x-device-token':localStorage.getItem('bh_device_token')||''},
        body: JSON.stringify({ mode:'report', days, history: summary })
      });
      const j = await r.json();
      const body = document.getElementById('ktReportBody');
      if(!body) return;
      if(!j.ok){ body.innerHTML = '<div style="color:var(--red,#ef4444)">❌ AI xatoligi</div>'; return; }
      // Markdown → oddiy HTML
      const html = j.content
        .replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')
        .replace(/\n/g,'<br>');
      body.innerHTML = html;
    }catch(e){
      const body = document.getElementById('ktReportBody');
      if(body) body.innerHTML = '<div style="color:var(--red,#ef4444)">❌ '+e.message+'</div>';
    }
  }

  // ---------- HOME UI QO'SHIMCHALARI ----------
  function injectHomeBits(){
    const home = document.getElementById('pgHome');
    if(!home || document.getElementById('ktWeatherBanner')) return;
    // Ob-havo bannerni progress kartochka tepasiga
    const banner = document.createElement('div');
    banner.id = 'ktWeatherBanner';
    banner.style.cssText = 'display:none;align-items:center;gap:10px;padding:10px 14px;margin:0 0 12px 0;background:var(--glass-bg,rgba(255,255,255,.05));border:1px solid var(--bdr,#334155);border-radius:14px;font-size:13px;color:var(--tx,#fff)';
    home.insertBefore(banner, home.firstChild);
    weatherBanner();
  }

  // ---------- APPLY / TICK ----------
  function applyFeatures(){
    updateMicFab();
    weatherBanner();
    checkBadges();
  }

  function tick(){
    try{ maybeSendBriefing(); checkVictory(); checkBadges(); }catch(e){}
  }

  // ---------- BOOTSTRAP ----------
  function boot(){
    if(!window.S){ setTimeout(boot,300); return; }
    window.S.extras = window.S.extras || {};
    // Standart yoqilgan bo'lsin (birinchi marta)
    ['weather','briefing','confetti','streakAnim','streakFreeze','badges','hotkeys','templates'].forEach(k=>{
      if(window.S.extras[k]===undefined) window.S.extras[k]=true;
    });
    if(window.S.extras.voiceAdd===undefined) window.S.extras.voiceAdd=true;
    try{ window.persist && window.persist(); }catch(e){}
    injectHomeBits();
    initHotkeys();
    applyFeatures();
    tick();
    setInterval(tick, 60*1000);
    // Har toggleTask/renderSchedule dan keyin g'alabani tekshirish
    const origRender = window.renderSchedule;
    if(typeof origRender === 'function'){
      window.renderSchedule = function(){ const r = origRender.apply(this, arguments); try{ checkVictory(); }catch(e){} return r; };
    }
  }
  document.addEventListener('DOMContentLoaded', boot);
  if(document.readyState !== 'loading') boot();

  // ---------- EXPORT ----------
  window.KTExtras = {
    settingsSection, afterRenderSettings, toggle,
    showReport, applyTemplate, sendBriefingNow, startVoice,
    fireConfetti, calcStreak
  };
})();
