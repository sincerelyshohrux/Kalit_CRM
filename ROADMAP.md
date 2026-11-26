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

## 3-bosqich — Frontend asosi + dizayn tizimi
- [ ] Vite + React + TS, router, API client (token bilan)
- [ ] Dizayn tizimi: ranglar, glass panellar, tugmalar, inputlar, modal, jadval
- [ ] Layout: chap menyu + yuqori panel (qidiruv, bildirishnomalar, profil)
- [ ] GSAP "pill" animatsiyasi: menyu va tablar uchun (oldingi cheti tez, orqa cheti kechroq yetib keladi)
- [ ] Login sahifasi
- [ ] Platforma admin paneli qobig'i: kompaniyalar ro'yxati, qo'shish, bloklash

**Natija:** login qilib, videodagidek animatsiyali dashboardga kirish mumkin (rolga qarab kompaniya yoki admin paneli).

## 4-bosqich — Shaxmatka sahifasi (asosiy funksiya)
- [ ] Loyiha va blok tanlash (animatsiyali tablar)
- [ ] Qavatlar × kvartiralar to'ri, holatga qarab ranglar
- [ ] Filtrlar: xonalar soni, narx oralig'i, holat
- [ ] Kvartiraga bosilganda yon panel: ma'lumotlari va amallar
- [ ] Loyihalar sahifasi: loyiha va blok qo'shish

**Natija:** menejer shaxmatkada bo'sh kvartiralarni ko'radi.

## 5-bosqich — Mijozlar va bron
- [ ] Mijozlar bazasi: F.I.Sh., telefon, manba (Instagram, Telegram, tanish, ofis), izoh, mas'ul menejer
- [ ] Lid holatlari: yangi → bog'lanildi → ko'rishga keldi → bron → shartnoma / rad etdi
- [ ] Kvartirani bron qilish (muddati bilan); muddat tugasa avtomatik bekor bo'ladi
- [ ] Mijozlar sahifasi: jadval, qidiruv, qo'shish va tahrirlash

**Natija:** mijozni bazaga kiritib, unga kvartira bron qilish mumkin.

## 6-bosqich — Shartnoma va rassrochka
- [ ] Shartnoma tuzish: boshlang'ich to'lov, muddat (oylar), boshlanish sanasi
- [ ] To'lov grafigini avtomatik yaratish
- [ ] To'lov qabul qilish (naqd, karta, Click, Payme, bank) va grafik bo'yicha taqsimlash
- [ ] Shartnoma PDF'ini shablon asosida yaratish
- [ ] Shartnomalar sahifasi: ro'yxat, batafsil ko'rish, to'lovlar tarixi

**Natija:** kvartira sotiladi, rassrochka grafigi tuziladi va to'lovlar kuzatiladi.

## 7-bosqich — Qarzdorlar va dashboard
- [ ] Qarzdorlar: muddati o'tgan to'lovlar, necha kun kechikkani, summasi
- [ ] Dashboard: sotilgan / bron / bo'sh kvartiralar, tushum, kutilayotgan to'lovlar, qarz
- [ ] Grafiklar: oylik sotuv, oylik tushum
- [ ] Menejerlar reytingi (KPI)

**Natija:** rahbar bitta sahifada biznes holatini ko'radi.

## 8-bosqich — Integratsiyalar va avtomatlashtirish
- [ ] Telegram bot (aiogram): mijozga to'lov eslatmasi, menejerga yangi lid haqida xabar
- [ ] SMS eslatma (Eskiz.uz)
- [ ] Click / Payme orqali onlayn to'lov havolasi
- [ ] Excel'ga eksport (mijozlar, to'lovlar, qarzdorlar)
- [ ] Amallar tarixi (audit log): kim, qachon, nimani o'zgartirdi

## 9-bosqich — Ishga tushirish (deploy)
- [ ] Docker + docker-compose (api, db, frontend, nginx)
- [ ] PostgreSQL, backup
- [ ] Domen + HTTPS
- [ ] Demo kompaniya va demo ma'lumotlar (taqdimot uchun)

---

### Xavfsizlik (2-bosqichda qo'shilgan, keyingi bosqichlarda ham amal qiladi)
- Parollar Argon2 bilan saqlanadi; kuchli parol talablari
- Brute-force himoyasi: telefon/IP bo'yicha 5 xato urinishdan keyin 15 daqiqa blok
- JWT: access 15 daqiqa, refresh 7 kun + rotatsiya; parol o'zgarsa yoki xodim bloklansa barcha tokenlar bekor
- Rate limit: anonim 60/daq, foydalanuvchi 600/daq, ommaviy amallar 30/daq
- Tenant izolyatsiyasi: queryset + FK maydonlar faqat o'z kompaniyasini ko'radi (IDOR himoyasi)
- Rollar bo'yicha ruxsat (direktor / menejer / kassir)
- Fayl yuklash: haqiqiy format tekshiruvi, 5 MB limit, tasodifiy fayl nomlari
- Xavfsizlik sarlavhalari, productionda HTTPS/HSTS, admin manzili sozlanadi, Swagger faqat DEBUGda ochiq
- Xatolar productionda ichki tafsilotni oshkor qilmaydi; login hodisalari logga yoziladi

### Reliz
To'liq mahsulot chiqariladi: 1–9-bosqichlarning hammasi tayyor bo'lgach ishga tushiriladi.
Bosqichlar ketma-ket bajariladi, har biri tugagach tekshirilib keyingisiga o'tiladi.

### Keyingi mahsulot
Kalit CRM'dan keyin shu brend ostida **Kalit Shop** — Instagram/Telegram/Uzum sotuvchilari uchun CRM.
