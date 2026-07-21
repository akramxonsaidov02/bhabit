## Umumiy ko'rinish

So'ragan narsalaringizni bitta yirik bosqichda emas, mantiqiy 4 bosqichga bo'lib qo'shaman. Sababi: ba'zilari bir-biriga bog'liq (masalan real-time sync bo'lmasa, "boshqa qurilmada chiqib qolish" ishlamaydi), ba'zilari esa mustaqil (auto-select, kunlik vazifalar).

Avval kichik aniqlashtirish kerak — pastda "Savollar" bo'limi bor. Javob berganingizdan keyin darhol boshlayman.

## Bosqich 1 — Backend va autentifikatsiya poydevori

Hozir ilovangiz butunlay `localStorage` da ishlaydi. Ko'p qurilmali sinx, faol qurilmalar ro'yxati, force-logout, QR handshake — bularning barchasi backend talab qiladi. **Lovable Cloud** yoqaman (Supabase asosida, tekin plan bor, tashqi hisob kerak emas).

Qo'shiladigan jadvallar:
- `users` — foydalanuvchi identifikatori (device fingerprint asosida)
- `devices` — har bir qurilma (user_agent parse qilinib "Windows 11 — Chrome" ko'rinishida), `is_master`, `last_seen`, `session_token`
- `tasks` — vazifalar (hozirgi localStorage strukturasi bilan bir xil)
- `task_completions` — kunlik bajarilganlik `(task_id, date, done)` — kunlik hisob shu yerda
- `settings` — foydalanuvchi sozlamalari (dayStart, sleep, prayers, toggles)
- `pending_qr_sessions` — QR handshake uchun (session_id, status, target_user_id)

Real-time: Supabase Realtime (WebSocket asosida) — hech qanday alohida server yozish shart emas, jadvallardagi o'zgarishlar avtomatik push bo'ladi.

## Bosqich 2 — Kirish oqimi

1. **Birinchi marta kirish** (hech qanday qurilma ro'yxatdan o'tmagan):
   - "Kirish uchun PIN kod yoqasizmi?" degan oyna
   - **Yo'q** → ochiq foydalanuvchi sifatida kiradi (device fingerprint yaratiladi, `is_master=true`)
   - **Ha** → PIN kodni sozlash oynasi (bu **statik PIN**, dynamic emas — Master qurilmani belgilash uchun)
     - PIN kiritildi → device `is_master=true` qilib belgilanadi
     - "Biometrikani yoqasizmi?" so'raladi (WebAuthn API orqali, iloji bo'lsa)

2. **Master qurilmada qayta kirish**:
   - **Dynamic PIN**: joriy vaqtning `HHMM` formati (siz aytganingizdek)
   - To'g'ri kiritilsa → asosiy sahifa
   - Sozlamalarida "QR skanerlash" tugmasi ko'rinadi

3. **Yangi qurilmadan kirish**:
   - Sahifa avtomatik QR ko'rsatadi (60 soniyada yangilanadi)
   - Supabase Realtime kanaliga ulanib, tasdiq kutadi
   - Master QR ni skanerlaganda → `SUCCESS_AUTH` keladi → 1 soniya ichida asosiy sahifaga o'tadi

## Bosqich 3 — Real-time sinx va faol qurilmalar

- Barcha `tasks`, `settings`, `task_completions` jadvallariga Supabase Realtime subscription
- Bir qurilmada o'zgarish bo'lsa, boshqasida darhol (sahifani yangilashsiz) yangilanadi
- Sozlamalar → "Faol qurilmalar" bo'limi:
  - `User-Agent` parse qilinib "Windows 11 — Chrome", IP, oxirgi faollik
  - Har birida "Chiqarib yuborish" tugmasi (faqat master ko'radi)
  - Bosilganda → o'sha qurilma `FORCE_LOGOUT` xabarini realtime oladi, avtomatik QR sahifaga qaytadi

## Bosqich 4 — Vazifa va vaqt yaxshilanishlari

Bu qism backendsiz ham ishlaydi, lekin sinx uchun 1–3 bosqichdan keyin qo'shilishi mantiqli.

1. **Yangi vazifa qo'shish oynasi (kengaytirilgan)**:
   - Nomi, **boshlanish vaqti**, **tugash vaqti**, kategoriya (yoki "AI aniqlasin"), muhimlik (yoki "AI aniqlasin"), **Auto-select** toggle
   - Auto-select yoqilsa → aniq vaqt so'raladi → o'sha vaqt kelganda vazifa avtomatik ✅ bo'ladi + bildirishnoma keladi
   - Vaqt konflikti bo'lsa va yangi vazifa "muhim" bo'lsa → eski vazifani ikkiga bo'ladi ("1-qism", "2-qism") va orasiga qo'yadi
   - O'chirilganda → ikki qism yana bir vazifaga birlashadi

2. **Proporsional taqsimlash**:
   - Kun boshini o'zgartirsangiz (masalan 6:30 → 7:00), namoz vaqtlaridan tashqari barcha vazifalar proporsional siljiydi/qisqaradi
   - Vazifa qo'shilganda/o'chirilganda ham qolgan vazifalar teng foizda moslashadi
   - Namoz vazifalari (cat=`prayer`) o'zgarmas tayanch nuqta

3. **Haftalik ko'rinish**:
   - Top-bar ostida 7 kunlik hafta (Du–Ya)
   - Faqat o'tgan va bugungi kunni bosish mumkin, kelasi kunlar disabled
   - Har kun uchun alohida `task_completions` yozuvi — bugun qo'shilgan yangi vazifa kechagi 100% ni buzmaydi

## Qo'shilmaydigan / xotirada saqlanadigan narsalar

Aytganingizdek quyidagilarni **hozir qo'shmayman**, faqat xotiraga yozib qo'yaman:
- Google/Telegram bilan ro'yxatdan o'tish
- Telegram bot orqali kod tasdiqlash
- Maxfiy kod (`meningshaxsiymaxfiykodim...`) va 37 ta oldindan yuklangan vazifa
- 3 marta xato → Telegram xabar + IP blok
- "Vazifalarni qaytarasizmi?" flow

Bu narsalar kelajakda qo'shilishi mumkin degan belgi bilan `mem://` ga saqlanadi.

## Savollar (iltimos javob bering)

1. **Statik PIN kerakmi?** Dynamic PIN (soat=parol) mantiqan faqat "kim kirayotganini tekshirish" uchun ishlaydi, chunki uni har kim topa oladi. Master qurilmani belgilash uchun **statik 4-6 raqamli PIN**ni birinchi kirishda so'ramoqchimanmi? (Tavsiya: HA — dynamic PIN esa keyingi kirishlarda tezkor tasdiq sifatida qoladi.)

2. **Biometrika**: WebAuthn brauzerlarda `platform authenticator` bilan ishlaydi (Windows Hello, Touch ID). iOS Safari da cheklovlar bor. Faqat qo'llab-quvvatlaydigan brauzerlarda tugma ko'rinsin va aks holda "Bu qurilmangizda ishlamaydi" desin — shundaymi?

3. **Foydalanuvchi identifikatori**: Hozir Cloud'da rasmiy auth (email/password/Google) yo'q. **Device fingerprint** (brauzer + PIN) orqali anonim foydalanuvchi yaratsammi? Bu Telegram/Google auth qo'shilmagunicha vaqtinchalik yechim. (Alternativa: hech nimasiz — lekin unda barcha qurilmalar bitta hisob deb qabul qilinadi va "faol qurilmalar" ma'nosini yo'qotadi.)

4. **QR skanerlash**: `html5-qrcode` kutubxonasini qo'shsam bo'ladimi? (~40KB, kamera orqali skaner uchun).

## Texnik tafsilotlar

- **Ma'lumotlar bazasi**: Supabase Postgres (Lovable Cloud orqali)
- **Realtime**: Supabase Realtime channels (WebSocket ostida)
- **QR generatsiya**: `qrcode` npm paketi (client-side, ~15KB)
- **QR skanerlash**: `html5-qrcode` (~40KB)
- **User-agent parse**: `ua-parser-js` (~20KB) yoki qo'lda regex
- **WebAuthn**: brauzer native API, kutubxona shart emas
- **Kod joyi**: `public/kun-tartibim.html` ichida qolaveradi, lekin Supabase client script `<script src=".../supabase.js">` bilan qo'shiladi
- **RLS**: har bir jadvalda `auth.uid() = user_id` (agar rasmiy auth bo'lmasa, `session_token` orqali tekshirish)

Ish hajmi katta bo'lgani uchun 1-2-bosqichni birinchi patch'da, 3-4-bosqichni ikkinchi patch'da qilaman — shunda har bir bosqichni sinab ko'ra olasiz.

Yuqoridagi 4 ta savolga javob bering, keyin Lovable Cloud yoqib boshlayman.