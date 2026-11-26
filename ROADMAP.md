# Kalit CRM — Yo'l xaritasi

> "Bron'dan kalitgacha" — qurilish kompaniyalari (zastroyshiklar) uchun sotuv CRM.

**Stack:** Django + Django REST Framework + PostgreSQL + Celery/Redis · React + TypeScript + Vite + GSAP
**Panellar:** 1) Kompaniya paneli (direktor, menejer, kassir) · 2) Platforma admin paneli (Kalit jamoasi: kompaniyalar, obunalar) — ikkalasi ham bir xil glass dizaynda
**Dizayn:** kulrang glassmorphism, animatsiyali "pill" menyu (reference video uslubida)
**Til:** interfeys o'zbekcha (keyin ruscha qo'shiladi)

---

## 1-bosqich — Poydevor (backend asosi) ✅
- [x] Loyiha strukturasi: `backend/` (Django + DRF); `frontend/` 3-bosqichda
- [x] Konfiguratsiya (`.env`), PostgreSQL, migratsiyalar
- [x] Kompaniya modeli (STIR, obuna muddati, faol/bloklangan)
- [x] Foydalanuvchilar (telefon raqam bilan login) va rollar: `superadmin`, `direktor`, `menejer`, `kassir`
- [x] JWT bilan login, `GET /auth/me`
- [x] Multi-tenant: har bir qurilish kompaniyasi faqat o'z ma'lumotini ko'radi (`company_id`)
- [x] Xodimlar API (direktor menejer qo'shadi), kompaniya profili API
- [x] Platforma admin API: kompaniya + direktor yaratish, bloklash, obuna
- [x] Django Admin, Swagger (`/api/docs/`), demo seed, testlar

**Natija:** login qilib, token olish mumkin; Swagger ishlaydi; kompaniyalar bir-birining ma'lumotini ko'rmaydi.

## 2-bosqich — Obyektlar va shaxmatka (backend) ✅
- [x] Modellar: Loyiha (ЖК) → Blok (bino) → Qavat → Kvartira
- [x] Blok yaratganda kvartiralarni avtomatik generatsiya qilish (qavatlar × har qavatdagi xonadonlar)
- [x] Kvartira: xonalar soni, maydon (m²), 1 m² narxi, umumiy narx, holat
- [x] Holatlar: `bo'sh` · `bron` · `sotilgan` · `sotuvda emas`
- [x] Narx o'zgarishlari tarixi (kim, qachon, nega)
- [x] `GET /projects/{id}/chessboard` — shaxmatka uchun to'liq ma'lumot
- [x] Narxlarni ommaviy o'zgartirish (qavat yoki blok bo'yicha)

- [x] Xavfsizlik kuchaytirildi (pastdagi "Xavfsizlik" bo'limiga qarang)

**Natija:** API orqali loyiha, blok va kvartiralarni yaratib, shaxmatkani olish mumkin.

## 3-bosqich — Frontend asosi + dizayn tizimi ✅
- [x] Vite + React + TS, router, API client (token bilan)
- [x] Dizayn tizimi: ranglar, glass panellar, tugmalar, inputlar, modal, jadval
- [x] Layout: chap menyu + yuqori panel (qidiruv, bildirishnomalar, profil)
- [x] GSAP "pill" animatsiyasi: menyu va tablar uchun (oldingi cheti tez, orqa cheti kechroq yetib keladi)
- [x] Login sahifasi
- [x] Platforma admin paneli qobig'i: kompaniyalar ro'yxati, qo'shish, bloklash

- [x] Kompaniya dashboardi (real ma'lumot: xonadonlar statistikasi, loyihalar bo'yicha sotuv, sotuv darajasi dial)
- [x] Sozlamalar: profil, parolni almashtirish
- [x] Mobil versiya (chapdan chiqadigan menyu)

**Natija:** login qilib, videodagidek animatsiyali dashboardga kirish mumkin (rolga qarab kompaniya yoki admin paneli).

## 4-bosqich — Shaxmatka sahifasi (asosiy funksiya)
- [ ] Loyiha va blok tanlash (animatsiyali tablar)
- [ ] Qavatlar × kvartiralar to'ri, holatga qarab ranglar
- [ ] Filtrlar: xonalar soni, narx oralig'i, holat
- [ ] Kvartiraga bosilganda yon panel: ma'lumotlari va amallar
- [ ] Loyihalar sahifasi: loyiha va blok qo'shish
- [ ] **Rasmlar:** loyiha galereyasi (bir nechta rasm), blok rasmlari, xonadon planirovkasi (rasm), drag-and-drop yuklash, tartibni o'zgartirish
- [ ] **Lokatsiya:** loyiha uchun xaritada nuqta tanlash (kenglik/uzunlik) + manzil, yaqin joylar (maktab, metro)

**Natija:** menejer shaxmatkada bo'sh kvartiralarni ko'radi.

## 5-bosqich — Mijozlar va bron
- [ ] Mijozlar bazasi: F.I.Sh., telefon, manba (Instagram, Telegram, tanish, ofis), izoh, mas'ul menejer
- [ ] Lid holatlari: yangi → bog'lanildi → ko'rishga keldi → bron → shartnoma / rad etdi
- [ ] Kvartirani bron qilish (muddati bilan); muddat tugasa avtomatik bekor bo'ladi
- [ ] Mijozlar sahifasi: jadval, qidiruv, qo'shish va tahrirlash

**Natija:** mijozni bazaga kiritib, unga kvartira bron qilish mumkin.

## 6-bosqich — Ommaviy sayt (login talab qilinmaydi)
Har bir kompaniya uchun mijozlar ko'radigan ochiq sahifa: `kalit.uz/<kompaniya>` (keyin o'z domeni).
- [ ] Loyihalar ro'yxati: rasmlar, lokatsiya xaritada, topshirish sanasi
- [ ] Ommaviy shaxmatka: bo'sh xonadonlar, narxlar, planirovkalar, filtrlar (xona, narx, qavat)
- [ ] Xonadon sahifasi: rasmlar, maydon, narx, rassrochka kalkulyatori
- [ ] **Ariza formasi:** ism, familiya, telefon (+ qaysi xonadon) → CRM'ga yangi lid bo'lib tushadi, menejerlarga bildirishnoma
- [ ] Direktor sozlaydi: sayt yoqilgan/o'chirilgan, narxlar ko'rinsinmi, qaysi loyihalar chiqsin
- [ ] SEO: sarlavhalar, Open Graph (Telegram/Instagram'da chiroyli ko'rinishi)
- [ ] **Xavfsizlik:** faqat ochiq maydonlar chiqadi (mijoz ismlari, shartnomalar, ichki izohlar hech qachon), ariza uchun rate limit + honeypot + Cloudflare Turnstile (bot himoyasi), telefon validatsiyasi, takroriy arizalarni birlashtirish

**Natija:** begona odam login qilmasdan barcha bo'sh xonadon va narxlarni ko'radi va ariza qoldiradi; ariza menejerga boradi.

## 7-bosqich — Shartnoma va rassrochka
- [ ] Shartnoma tuzish: boshlang'ich to'lov, muddat (oylar), boshlanish sanasi
- [ ] To'lov grafigini avtomatik yaratish
- [ ] To'lov qabul qilish (naqd, karta, Click, Payme, bank) va grafik bo'yicha taqsimlash
- [ ] Shartnoma PDF'ini shablon asosida yaratish
- [ ] Shartnomalar sahifasi: ro'yxat, batafsil ko'rish, to'lovlar tarixi

**Natija:** kvartira sotiladi, rassrochka grafigi tuziladi va to'lovlar kuzatiladi.

## 8-bosqich — Qarzdorlar va dashboard
- [ ] Qarzdorlar: muddati o'tgan to'lovlar, necha kun kechikkani, summasi
- [ ] Dashboard: sotilgan / bron / bo'sh kvartiralar, tushum, kutilayotgan to'lovlar, qarz
- [ ] Grafiklar: oylik sotuv, oylik tushum
- [ ] Menejerlar reytingi (KPI)

**Natija:** rahbar bitta sahifada biznes holatini ko'radi.

## 9-bosqich — Integratsiyalar va avtomatlashtirish
- [ ] Telegram bot (aiogram): mijozga to'lov eslatmasi, menejerga yangi lid haqida xabar
- [ ] SMS eslatma (Eskiz.uz)
- [ ] Click / Payme orqali onlayn to'lov havolasi
- [ ] Excel'ga eksport (mijozlar, to'lovlar, qarzdorlar)
- [ ] Amallar tarixi (audit log): kim, qachon, nimani o'zgartirdi

## 10-bosqich — Ishga tushirish (deploy)
- [ ] Docker + docker-compose (api, db, frontend, nginx)
- [ ] PostgreSQL, backup
- [ ] Domen + HTTPS
- [ ] Demo kompaniya va demo ma'lumotlar (taqdimot uchun)

---

### Xavfsizlik (har bosqichda qo'shib boriladi)
- Parollar Argon2 bilan saqlanadi; kuchli parol talablari
- Brute-force himoyasi: telefon/IP bo'yicha 5 xato urinishdan keyin 15 daqiqa blok
- JWT: access 15 daqiqa, refresh 7 kun + rotatsiya; parol o'zgarsa yoki xodim bloklansa barcha tokenlar bekor
- Rate limit: anonim 60/daq, foydalanuvchi 600/daq, ommaviy amallar 30/daq
- Tenant izolyatsiyasi: queryset + FK maydonlar faqat o'z kompaniyasini ko'radi (IDOR himoyasi)
- Rollar bo'yicha ruxsat (direktor / menejer / kassir)
- Fayl yuklash: haqiqiy format tekshiruvi, 5 MB limit, tasodifiy fayl nomlari
- Xavfsizlik sarlavhalari, productionda HTTPS/HSTS, admin manzili sozlanadi, Swagger faqat DEBUGda ochiq
- Xatolar productionda ichki tafsilotni oshkor qilmaydi; login hodisalari logga yoziladi
- **(3-bosqich)** Brauzerda refresh token httpOnly + SameSite=Strict cookie'da (JS o'qiy olmaydi), access token faqat xotirada; localStorage'da hech qanday token yo'q
- **(3-bosqich)** Cookie bilan ishlovchi auth so'rovlari `X-Kalit-Client` sarlavhasini talab qiladi — CSRF himoyasi; refresh endpointi ham rate limit ostida
- **(3-bosqich)** Frontend va API bir origin'da (Vite proxy / keyin nginx) — CORS ochilmaydi; rol bo'yicha sahifa himoyasi (asosiy tekshiruv baribir backendda)

### Reliz
To'liq mahsulot chiqariladi: 1–10-bosqichlarning hammasi tayyor bo'lgach ishga tushiriladi.
Bosqichlar ketma-ket bajariladi, har biri tugagach tekshirilib keyingisiga o'tiladi.

### Keyingi mahsulot
Kalit CRM'dan keyin shu brend ostida **Kalit Shop** — Instagram/Telegram/Uzum sotuvchilari uchun CRM.
