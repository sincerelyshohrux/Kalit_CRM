"""Lokal ishlab chiqish uchun demo ma'lumotlar.

    python manage.py seed_demo

Faqat DEBUG rejimida ishlaydi. Demo login ma'lumotlari pastdagi DEMO_USERS'da.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.companies.models import Company

DEMO_PASSWORD = "Kalit-demo-2026"

DEMO_USERS = [
    # (telefon, ism, familiya, rol)
    ("+998900000001", "Platforma", "Admin", Role.SUPERADMIN),
    ("+998901110001", "Jasur", "Karimov", Role.DIRECTOR),
    ("+998901110002", "Dilnoza", "Rahimova", Role.MANAGER),
    ("+998901110003", "Sardor", "Aliyev", Role.MANAGER),
    ("+998901110004", "Malika", "Yusupova", Role.CASHIER),
]


class Command(BaseCommand):
    help = "Demo kompaniya va foydalanuvchilarni yaratadi (faqat DEBUG)."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo faqat DEBUG=True rejimida ishlaydi.")

        company, _ = Company.objects.get_or_create(
            name="Toshkent City Qurilish",
            defaults={
                "legal_name": '"TOSHKENT CITY QURILISH" MCHJ',
                "inn": "301234567",
                "phone": "+998712000000",
                "city": "Toshkent",
                "address": "Mirobod tumani, Amir Temur ko'chasi, 1",
                "plan": Company.Plan.BUSINESS,
                "subscription_until": timezone.localdate() + timedelta(days=365),
                "max_users": 25,
            },
        )
        Company.objects.get_or_create(
            name="Samarqand Invest Build",
            defaults={"city": "Samarqand", "plan": Company.Plan.TRIAL,
                      "subscription_until": timezone.localdate() + timedelta(days=7)},
        )

        for phone, first, last, role in DEMO_USERS:
            if User.objects.filter(phone=phone).exists():
                continue
            if role == Role.SUPERADMIN:
                User.objects.create_superuser(phone, DEMO_PASSWORD, first_name=first, last_name=last)
            else:
                User.objects.create_user(
                    phone, DEMO_PASSWORD, first_name=first, last_name=last, role=role, company=company
                )

        self.stdout.write(self.style.SUCCESS("Demo ma'lumotlar tayyor."))
        self.stdout.write("Barcha demo foydalanuvchilar paroli: DEMO_PASSWORD (seed_demo.py ichida).")
        for phone, first, last, role in DEMO_USERS:
            self.stdout.write(f"  {phone}  {role:<10}  {first} {last}")
