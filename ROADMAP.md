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

## 4-bosqich — Shaxmatka sahifasi (asosiy funksiya) ✅
- [x] Loyiha va blok tanlash (animatsiyali tablar)
- [x] Qavatlar × kvartiralar to'ri, holatga qarab ranglar; mos kelmaganlar xiralashadi
- [x] Filtrlar: xonalar soni, narx oralig'i, holat
- [x] Kvartiraga bosilganda yon panel: planirovka, ma'lumotlar, narxni o'zgartirish (sabab bilan), sotuvdan olish, narx tarixi
- [x] Narxlarni ommaviy o'zgartirish oynasi (loyiha/blok, qavatlar, xonalar; foiz/summa/aniq narx)
- [x] Loyihalar sahifasi: loyiha qo'shish/tahrirlash, blok qo'shish (planirovka quruvchi + narx bo'yicha oldindan ko'rish)
- [x] **Rasmlar:** loyiha galereyasi (turlari: vizualizatsiya, fasad, interyer, hudud, qurilish jarayoni), blokka biriktirish, drag-and-drop yuklash, sudrab tartiblash, birinchi rasm — muqova, lightbox
- [x] **Planirovkalar:** generatsiyada avtomatik yaratiladi, har biriga chizma yuklanadi va shu turdagi barcha xonadonlarda ko'rinadi
- [x] **Lokatsiya:** xaritada nuqta (bosish/surish, koordinata yoki Google/Yandex havolasini qo'yish, "mening joylashuvim"), yaqin joylar (maktab, metro, park...)
- [x] Xodimlar sahifasi: qo'shish, rol, parol, bloklash/faollashtirish
- [x] Demo rasmlar: real rasmlar kelguncha kodda chizilgan fasad, hovli, interyer, qurilish va planirovka chizmalari (`manage.py seed_media`)
- [x] Xavfsizlik kuchaytirildi (pastga qarang)

**Natija:** menejer shaxmatkada bo'sh kvartiralarni ko'radi; direktor loyiha, blok, rasm, planirovka va lokatsiyani o'zi boshqaradi.

## 5-bosqich — Mijozlar va bron ✅
- [x] Mijozlar bazasi: F.I.Sh., telefon (+ qo'shimcha), manba (Instagram, Telegram, tanish, ofis, qo'ng'iroq, sayt), izoh, mas'ul menejer, qiziqqan loyiha, byudjet
- [x] Lid holatlari: yangi → bog'lanildi → ko'rishga keldi → bron → shartnoma / rad etdi (rad etish sababi bilan; bron va shartnoma — avtomatik)
- [x] Mijoz tarixi: izoh, qo'ng'iroq, uchrashuv, holat/menejer o'zgarishlari, bron hodisalari
- [x] Kvartirani bron qilish (muddati bilan, bron paytidagi narx saqlanadi); uzaytirish va bekor qilish (sababi bilan)
- [x] Muddat tugasa bron avtomatik yopiladi, xonadon yana sotuvga chiqadi (har so'rovda + `manage.py expire_bookings` cron uchun)
- [x] Mijozlar sahifasi: voronka, filtrlar (holat, manba, menejer), ism/telefon bo'yicha qidiruv, qo'shish va tahrirlash, mijoz paneli
- [x] Bronlar sahifasi: faol / muddati tugagan / bekor qilingan, qolgan vaqt, direktor uchun bron muddati sozlamasi
- [x] Shaxmatkadan bron: xonadon panelida mijozni qidirish yoki yangisini qo'shish, faol bron ma'lumoti
- [x] Xavfsizlik kuchaytirildi (pastga qarang)

**Natija:** mijozni bazaga kiritib, unga kvartira bron qilish mumkin.

## 6-bosqich — Ommaviy sayt (login talab qilinmaydi) ✅
Har bir kompaniya uchun mijozlar ko'radigan ochiq sahifa: `kalit.uz/<kompaniya>` (keyin o'z domeni).
- [x] Loyihalar ro'yxati: rasmlar, lokatsiya xaritada, topshirish sanasi
- [x] Ommaviy shaxmatka: bo'sh xonadonlar, narxlar, planirovkalar, filtrlar (blok, xona, narx, faqat bo'sh)
- [x] Xonadon sahifasi: planirovka, maydon, qavat, narx, rassrochka kalkulyatori
- [x] **Ariza formasi:** ism, familiya, telefon (+ qaysi xonadon) → CRM'ga yangi lid bo'lib tushadi, menejerlarga bildirishnoma (panelda qo'ng'iroqcha)
- [x] Direktor sozlaydi: sayt yoqilgan/o'chirilgan, manzil (slug), narxlar ko'rinsinmi, qaysi loyihalar chiqsin, kalkulyator shartlari
- [x] SEO: sarlavhalar, Open Graph (Telegram/Instagram'da chiroyli ko'rinishi)
- [x] **Xavfsizlik:** faqat ochiq maydonlar chiqadi (mijoz ismlari, shartnomalar, ichki izohlar hech qachon), ariza uchun rate limit + honeypot + Cloudflare Turnstile (bot himoyasi), telefon validatsiyasi, takroriy arizalarni birlashtirish

**Natija:** begona odam login qilmasdan barcha bo'sh xonadon va narxlarni ko'radi va ariza qoldiradi; ariza menejerga boradi.

## 7-bosqich — Virtual tur va 3D (ommaviy saytda)
Stadiondagi "o'rindiqdan ko'rinish" g'oyasi, faqat xonadon uchun: mijoz xonadonni tanlaydi va ichkarisini hamda derazadan ko'rinishni o'z ko'zi bilan ko'radi.
- [ ] **Interaktiv fasad:** bino rasmi (render yoki dron surati) ustida qavat va xonadonlar belgilanadi; sichqoncha qavatni yoritadi, bosilganda o'sha qavat planirovkasi ochiladi. Admin uchun rasm ustida poligon chizish muharriri
- [ ] **3D shaxmatka:** blok parametrlaridan (qavat, podyezd) avtomatik 3D bino (three.js), xonadonlar holat rangida; aylantirib ko'rish
- [ ] **360° virtual tur:** har bir planirovka turi uchun xonalar panoramasi (360° rasm), "sudrab atrofga qarash", xonadan xonaga o'tish nuqtalari (hotspot), mobil giroskop
- [ ] **Derazadan ko'rinish:** qavat balandligi va tomon (shimol/janub...) bo'yicha dron panoramasi — har xonadon o'z qavatiga eng yaqin ko'rinishni oladi
- [ ] **Xonadon kartasi (videodagi pastki panel kabi):** maydon, qavat, tomon, quyosh tushishi, narx, "Ariza qoldirish" tugmasi, mini-shaxmatkada joylashuvi
- [ ] Ixtiyoriy (premium): arxitektordan GLB/3D model bo'lsa — to'liq 3D ko'rinish
- [ ] Admin: 360° rasmlarni yuklash, planirovka turiga biriktirish, hotspot qo'yish
- [ ] **Xavfsizlik:** katta fayllar uchun alohida limit (panorama ≤ 30 MB), serverda o'lchamini kichraytirish va WebP/tile'larga bo'lish, EXIF/GPS metama'lumotlarini o'chirish, faqat rasm formatlari, CDN orqali berish

**Kontent:** 360° rasmlar qurilish kompaniyasining arxitektura vizualizatsiyalaridan (ular deyarli har doim bor), namuna xonadondan (360° kamera yoki telefon) yoki dron suratidan olinadi.

**Natija:** mijoz saytda xonadonni tanlab, ichkarisini 360° aylanib ko'radi va derazadan ko'rinishni ko'radi — login qilmasdan.

## 8-bosqich — Shartnoma va rassrochka
- [ ] Shartnoma tuzish: boshlang'ich to'lov, muddat (oylar), boshlanish sanasi
- [ ] To'lov grafigini avtomatik yaratish
- [ ] To'lov qabul qilish (naqd, karta, Click, Payme, bank) va grafik bo'yicha taqsimlash
- [ ] Shartnoma PDF'ini shablon asosida yaratish
- [ ] Shartnomalar sahifasi: ro'yxat, batafsil ko'rish, to'lovlar tarixi

**Natija:** kvartira sotiladi, rassrochka grafigi tuziladi va to'lovlar kuzatiladi.

## 9-bosqich — Qarzdorlar va dashboard
- [ ] Qarzdorlar: muddati o'tgan to'lovlar, necha kun kechikkani, summasi
- [ ] Dashboard: sotilgan / bron / bo'sh kvartiralar, tushum, kutilayotgan to'lovlar, qarz
- [ ] Grafiklar: oylik sotuv, oylik tushum
- [ ] Menejerlar reytingi (KPI)

**Natija:** rahbar bitta sahifada biznes holatini ko'radi.

## 10-bosqich — Integratsiyalar va avtomatlashtirish
- [ ] Telegram bot (aiogram): mijozga to'lov eslatmasi, menejerga yangi lid haqida xabar
- [ ] SMS eslatma (Eskiz.uz)
- [ ] Click / Payme orqali onlayn to'lov havolasi
- [ ] Excel'ga eksport (mijozlar, to'lovlar, qarzdorlar)
- [ ] Amallar tarixi (audit log): kim, qachon, nimani o'zgartirdi

## 11-bosqich — Ishga tushirish (deploy)
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
- **(4-bosqich)** Har bir yuklangan rasm serverda qaytadan chiziladi va WebP qilinadi: EXIF/GPS (telefon rasmidagi joylashuv) o'chadi, rasm ichiga yashirilgan kod (polyglot) yo'qoladi; SVG/GIF qabul qilinmaydi
- **(4-bosqich)** "Dekompressiya bombasi" himoyasi (40 megapikseldan katta rasm ochilmasdan rad etiladi), rasm 15 MB, o'lcham 2560 px gacha kichraytiriladi
- **(4-bosqich)** Yuklash uchun alohida rate limit (300/soat), loyihaga 80 rasm / 120 planirovka limiti; o'chirilgan rasm fayllari diskdan ham o'chadi
- **(4-bosqich)** Rasm, blok va planirovka boshqa kompaniya loyihasiga biriktirilmaydi (IDOR); tartiblash faqat o'z loyihasidagi rasmlarning to'liq ro'yxati bilan
- **(4-bosqich)** Media URL'lari nisbiy (`/media/...`) — Host sarlavhasini soxtalashtirib boshqa domenga yo'naltirib bo'lmaydi
- **(4-bosqich)** "Atrofdagi joylar" JSON'i qat'iy sxema bo'yicha tekshiriladi (faqat ruxsat etilgan turlar va maydonlar), koordinatalar diapazoni tekshiriladi
- **(4-bosqich)** Bloklangan xodimni qayta faollashtirish ham tarif limitiga (max_users) tekshiriladi
- **(5-bosqich)** Ikki menejer bitta xonadonni bir vaqtda bron qila olmaydi: tranzaksiya + `SELECT … FOR UPDATE` va bazadagi "bitta faol bron" cheklovi
- **(5-bosqich)** Menejer faqat o'z va biriktirilmagan mijozlarni ko'radi; begona mijoz/bron 404, dublikat telefonda begona mijoz ismi oshkor qilinmaydi, shaxmatkada esa faqat menejer ismi ko'rinadi
- **(5-bosqich)** Menejer bronni kompaniya sozlamasidagi muddatdan (standart 3 kun) uzoqqa qila olmaydi, uzaytirishda ham jami muddat cheklanadi; direktor — 30 kungacha
- **(5-bosqich)** Bekor qilish/uzaytirish — faqat bronni qilgan menejer yoki direktor; kassir faqat ko'radi; mas'ul menejerni faqat direktor o'zgartiradi
- **(5-bosqich)** Bron va sotilgan holatlar faqat bron moduli orqali o'zgaradi (qo'lda emas), bron qilingan xonadon narxi qotadi; bron tarixi bor mijozni o'chirib bo'lmaydi
- **(5-bosqich)** Bron yaratish uchun rate limit (120/soat), mijozlar ro'yxatini ommaviy eksport qilish yo'q, qidiruv uzunligi cheklangan; telefonlar bitta formatga keltiriladi
- **(6-bosqich)** Ommaviy API faqat oq ro'yxatdagi maydonlarni qaytaradi: bron, sotilgan va "sotuvda emas" xonadonlar bir xil "band" ko'rinadi, mijoz/menejer/izoh hech qachon chiqmaydi; o'chirilgan sayt yoki bloklangan kompaniya — oddiy 404
- **(6-bosqich)** Narxlar yopiq bo'lsa, narx filtri ham e'tiborsiz qoldiriladi (filtr orqali narxni "topib olish" mumkin emas)
- **(6-bosqich)** Ariza: 3/daq va 10/soat rate limit, honeypot maydoni, Cloudflare Turnstile (kalit berilsa), ism faqat harflar, xabarda havola taqiqlangan; mavjud mijoz telefoni bo'yicha birlashtiriladi, uning ismi almashtirilmaydi, 30 daqiqa ichidagi takror ariza qayta yozilmaydi
- **(6-bosqich)** OG havolalar Host sarlavhasidan emas, `PUBLIC_BASE_URL` dan quriladi; sarlavha va tavsif HTML-escape qilinadi; band slug'lar (`app`, `api`, `admin`, …) taqiqlangan
- **(6-bosqich)** Bildirishnomalarni har bir xodim faqat o'ziniki ko'radi va o'qilgan qiladi; sayt sozlamalarini faqat direktor o'zgartiradi

### Reliz
To'liq mahsulot chiqariladi: 1–11-bosqichlarning hammasi tayyor bo'lgach ishga tushiriladi.
Bosqichlar ketma-ket bajariladi, har biri tugagach tekshirilib keyingisiga o'tiladi.

### Keyingi mahsulot
Kalit CRM'dan keyin shu brend ostida **Kalit Shop** — Instagram/Telegram/Uzum sotuvchilari uchun CRM.
