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
.venv/bin/python manage.py seed_demo # demo kompaniya va foydalanuvchilar
.venv/bin/python manage.py runserver
```

- Swagger: http://localhost:8000/api/docs/
- Django Admin: http://localhost:8000/admin/
- Demo foydalanuvchilar va paroli: `apps/companies/management/commands/seed_demo.py`

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

## Rollar

| Rol | Nima qila oladi |
|---|---|
| `superadmin` | Platforma admini: kompaniyalarni yaratish, bloklash, tarif/obuna |
| `director` | O'z kompaniyasi: profil, xodimlar, barcha ma'lumotlar |
| `manager` | Sotuv: mijozlar, bron, shartnoma (keyingi bosqichlar) |
| `cashier` | To'lovlarni qabul qilish (keyingi bosqichlar) |

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
