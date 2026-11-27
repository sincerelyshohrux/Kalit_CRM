# Kalit CRM

**Bron'dan kalitgacha** — qurilish kompaniyalari (zastroyshiklar) uchun sotuv CRM:
shaxmatka, bron, shartnoma, rassrochka, qarzdorlar nazorati.

Bosqichlar va holat: [ROADMAP.md](ROADMAP.md)

## Struktura

```
backend/            Django + DRF API
  config/           sozlamalar, URL'lar
  apps/common/      asosiy modellar, ruxsatlar, tenant mixin
  apps/companies/   kompaniyalar (tenantlar), platforma admin API
  apps/accounts/    foydalanuvchilar, rollar, JWT auth, xodimlar, login xavfsizligi
  apps/realty/      loyihalar, bloklar, xonadonlar, shaxmatka, narxlar
  tests/            pytest testlar
frontend/           React + TypeScript + Vite
  src/components/   UI, layout, GSAP animatsiyalar (PillNav)
  src/pages/        kompaniya va platforma sahifalari
  src/lib/          API klient, formatlash
```

## Backendni ishga tushirish

Talab: PostgreSQL 15+ ishlab turgan bo'lishi kerak.

```bash
# bir marta: baza va foydalanuvchi
psql -d postgres -c "CREATE ROLE kalit LOGIN CREATEDB PASSWORD 'parol';"
psql -d postgres -c "CREATE DATABASE kalit OWNER kalit;"

cd backend
uv venv .venv --python 3.13          # yoki: python3 -m venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
cp .env.example .env                 # SECRET_KEY va DATABASE_URL ni to'ldiring
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo # demo kompaniya, foydalanuvchilar, loyihalar va demo rasmlar
.venv/bin/python manage.py runserver
```

- Swagger: http://localhost:8000/api/docs/
- Django Admin: http://localhost:8000/admin/
- Demo foydalanuvchilar va paroli: `apps/companies/management/commands/seed_demo.py`
- Demo rasmlar (real rasmlar kelguncha): `manage.py seed_media` — fasad, hovli, interyer, qurilish
  jarayoni va planirovka chizmalari kodda chiziladi; `--force` bilan qaytadan yaratiladi
- Demo mijozlar, bronlar va ommaviy sayt: `manage.py seed_crm` (`seed_demo` o'zi chaqiradi) → http://localhost:5173/toshkent-city
- Muddati o'tgan bronlarni yopish (productionda cron, har 5–10 daqiqada): `manage.py expire_bookings`
  (so'rovlar ichida ham avtomatik tekshiriladi, cron — qo'shimcha kafolat)
- Yuklangan fayllar `backend/media/` da (gitga kirmaydi)

Ommaviy sayt uchun `.env` sozlamalari:

- `PUBLIC_BASE_URL=https://kalit.uz` — havolalar va Open Graph shu manzildan quriladi
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile (berilmasa, bot tekshiruvi o'chiq,
  honeypot va rate limit baribir ishlaydi)
- Prod'da nginx `/<slug>…` sahifalarini Django'ga (`config.urls` dagi OG view) yuborsin — u
  `frontend/dist/index.html` ga sarlavha va OG teglarini qo'yib beradi; `/assets`, `/api`, `/media` — odatdagidek

Testlar: `.venv/bin/pytest`

## Frontendni ishga tushirish

Backend `localhost:8000` da ishlab turgan bo'lishi kerak (Vite `/api` ni unga proxy qiladi).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

- Kompaniya paneli: direktor/menejer/kassir sifatida kiring → `/app`
- Platforma admin paneli: superadmin sifatida kiring → `/platform`
- Ommaviy sayt: `/<slug>`, `/<slug>/loyiha/<id>`, `/<slug>/xonadon/<id>` (login kerak emas);
  direktor `/app/site` da yoqadi va sozlaydi
- Xarita: standart OpenStreetMap plitkalari. Prod'da katta trafik uchun o'z provayderingizni
  `frontend/.env` ga `VITE_MAP_TILES=https://.../{z}/{x}/{y}.png` qilib bering

## Rollar

| Rol | Nima qila oladi |
|---|---|
| `superadmin` | Platforma admini: kompaniyalarni yaratish, bloklash, tarif/obuna |
| `director` | O'z kompaniyasi: profil, xodimlar, barcha ma'lumotlar |
| `manager` | Sotuv: o'z mijozlari va bronlari (bron muddati — kompaniya sozlamasigacha), shartnoma (8-bosqich) |
| `cashier` | Mijoz va bronlarni ko'radi; to'lovlarni qabul qilish (8-bosqich) |

Har bir kompaniya faqat o'z ma'lumotlarini ko'radi (`CompanyScopedViewSetMixin`).
Bloklangan yoki obunasi tugagan kompaniya xodimlari tizimga kira olmaydi.
Xavfsizlik choralari ro'yxati: [ROADMAP.md](ROADMAP.md#xavfsizlik-har-bosqichda-qoshib-boriladi)

## API (v1)

| Metod | URL | Tavsif |
|---|---|---|
| POST | `/api/v1/auth/login/` | telefon + parol → `access`, `refresh`, `user` |
| POST | `/api/v1/auth/refresh/` | tokenni yangilash |
| POST | `/api/v1/auth/logout/` | refresh tokenni bekor qilish |
| GET/PATCH | `/api/v1/auth/me/` | joriy foydalanuvchi |
| POST | `/api/v1/auth/change-password/` | parolni almashtirish |
| GET/PATCH | `/api/v1/company/` | o'z kompaniyasi (tahrirlash — direktor) |
| CRUD | `/api/v1/employees/` | xodimlar (yozish — direktor, DELETE = bloklash) |
| CRUD | `/api/v1/platform/companies/` | superadmin: kompaniyalar (+ `suspend/`, `activate/`) |
| GET | `/api/v1/platform/stats/` | superadmin: platforma statistikasi |
| CRUD | `/api/v1/projects/` | loyihalar (ЖК) + statistika (yozish — direktor) |
| GET | `/api/v1/projects/{id}/chessboard/` | shaxmatka; filtr: `rooms`, `status`, `price_min/max`, `area_min/max`, `block` |
| CRUD | `/api/v1/blocks/` | bloklar; POST'da `generate` bilan xonadonlar avtomatik yaratiladi |
| GET/PATCH | `/api/v1/units/` | xonadonlar; filtrlar: loyiha, blok, xona, qavat, narx, maydon |
| POST | `/api/v1/units/bulk-price/` | ommaviy narx: `set` / `percent` / `amount` (bron/sotilganlar o'zgarmaydi) |
| GET | `/api/v1/units/{id}/price-history/` | narx o'zgarishlari tarixi |
| CRUD | `/api/v1/photos/?project=` | loyiha galereyasi; POST multipart (`project`, `image`, `kind`, `caption`, `block`) |
| POST | `/api/v1/photos/reorder/` | tartib: `{"project": 1, "ids": [5, 3, 4]}` (birinchisi — muqova) |
| CRUD | `/api/v1/layouts/?project=` | planirovkalar; `image` multipart (null — chizmani o'chirish) |
| CRUD | `/api/v1/clients/` | mijozlar; filtr: `status`, `source`, `manager`, `mine`, `unassigned`, `search` (ism yoki telefon bo'lagi) |
| GET | `/api/v1/clients/stats/` | voronka: holatlar bo'yicha soni |
| GET/POST | `/api/v1/clients/{id}/activities/` | mijoz tarixi; POST: `{"kind": "note"\|"call"\|"meeting", "text": "..."}` |
| GET/POST | `/api/v1/bookings/` | bronlar; POST: `{"unit": 1, "client": 2, "days": 3, "note": ""}` |
| POST | `/api/v1/bookings/{id}/cancel/` | bekor qilish: `{"reason": "..."}` |
| POST | `/api/v1/bookings/{id}/extend/` | uzaytirish: `{"days": 2}` |
| GET | `/api/v1/bookings/stats/` | holatlar bo'yicha soni va foydalanuvchiga ruxsat etilgan muddat |
| GET/PATCH | `/api/v1/site-settings/` | ommaviy sayt sozlamalari (o'zgartirish — direktor) |
| GET | `/api/v1/notifications/` | o'z bildirishnomalari: `{unread, results}`; `POST {id}/read/`, `POST read-all/` |
| GET | `/api/v1/public/sites/{slug}/` | **ochiq:** kompaniya va saytdagi loyihalar |
| GET | `/api/v1/public/sites/{slug}/projects/{id}/` | **ochiq:** loyiha, rasmlar, planirovkalar |
| GET | `/api/v1/public/sites/{slug}/projects/{id}/chessboard/` | **ochiq:** shaxmatka; filtr: `block`, `rooms`, `area_min/max`, `price_min/max` (narx ochiq bo'lsa), `free=1` |
| GET | `/api/v1/public/sites/{slug}/units/{id}/` | **ochiq:** xonadon |
| POST | `/api/v1/public/sites/{slug}/leads/` | **ochiq:** ariza `{"first_name", "last_name", "phone", "unit"?, "project"?, "message"?, "token"?}` |

### Blok yaratish namunasi

```json
POST /api/v1/blocks/
{
  "project": 1, "name": "A blok",
  "floors_count": 12, "entrances_count": 2, "units_per_floor": 4, "start_floor": 2,
  "generate": {
    "layout": [{"rooms": 1, "area": "42.5"}, {"rooms": 2, "area": "64"}, {"rooms": 3, "area": "86.3"}, {"rooms": 2, "area": "58.7"}],
    "base_price_per_m2": 9500000,
    "floor_step_percent": "0.8"
  }
}
```
