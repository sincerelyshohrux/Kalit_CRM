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
  apps/accounts/    foydalanuvchilar, rollar, JWT auth, xodimlar
  tests/            pytest testlar
frontend/           React (3-bosqichda)
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

## Rollar

| Rol | Nima qila oladi |
|---|---|
| `superadmin` | Platforma admini: kompaniyalarni yaratish, bloklash, tarif/obuna |
| `director` | O'z kompaniyasi: profil, xodimlar, barcha ma'lumotlar |
| `manager` | Sotuv: mijozlar, bron, shartnoma (keyingi bosqichlar) |
| `cashier` | To'lovlarni qabul qilish (keyingi bosqichlar) |

Har bir kompaniya faqat o'z ma'lumotlarini ko'radi (`CompanyScopedViewSetMixin`).
Bloklangan yoki obunasi tugagan kompaniya xodimlari tizimga kira olmaydi.

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
