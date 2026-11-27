"""Lokal ishlab chiqish uchun demo ma'lumotlar.

    python manage.py seed_demo

Faqat DEBUG rejimida ishlaydi. Demo login ma'lumotlari pastdagi DEMO_USERS'da.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management import call_command
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

        self._seed_realty(company)
        call_command("seed_media")
        call_command("seed_crm")
        self.stdout.write(self.style.SUCCESS("Demo ma'lumotlar tayyor."))
        self.stdout.write("Barcha demo foydalanuvchilar paroli: DEMO_PASSWORD (seed_demo.py ichida).")
        for phone, first, last, role in DEMO_USERS:
            self.stdout.write(f"  {phone}  {role:<10}  {first} {last}")

    def _seed_realty(self, company):
        import random
        from decimal import Decimal

        from apps.realty import services
        from apps.realty.models import Block, Project, Unit

        if Project.objects.filter(company=company).exists():
            return
        rnd = random.Random(42)
        projects = [
            ("Yangi Hayot Residence", "Yunusobod", Project.HousingClass.COMFORT, 9_500_000,
             [("A blok", 12, 2, 4), ("B blok", 12, 2, 4), ("C blok", 9, 1, 6)]),
            ("Mirobod Gardens", "Mirobod", Project.HousingClass.BUSINESS, 14_000_000,
             [("1-korpus", 16, 3, 4), ("2-korpus", 16, 2, 4)]),
        ]
        layouts = {
            4: [(1, "42.50"), (2, "64.00"), (3, "86.30"), (2, "58.70")],
            6: [(1, "38.00"), (2, "55.40"), (3, "78.90"), (1, "40.20"), (2, "61.00"), (4, "112.00")],
        }
        for name, district, cls, price, blocks in projects:
            project = Project.objects.create(
                company=company, name=name, city="Toshkent", district=district, housing_class=cls,
                address=f"{district} tumani", completion_date=timezone.localdate() + timedelta(days=540),
            )
            for i, (bname, floors, entrances, per_floor) in enumerate(blocks):
                block = Block.objects.create(
                    project=project, name=bname, floors_count=floors, entrances_count=entrances,
                    units_per_floor=per_floor, start_floor=2 if floors > 10 else 1, sort_order=i,
                )
                services.generate_units(
                    block, [services.LayoutItem(rooms=r, area=Decimal(a)) for r, a in layouts[per_floor]],
                    price, Decimal("0.8"),
                )
            # demo uchun: bir qismi sotilgan / bron / sotuvda emas
            units = list(Unit.objects.filter(block__project=project).values_list("id", flat=True))
            rnd.shuffle(units)
            n = len(units)
            Unit.objects.filter(id__in=units[: int(n * 0.35)]).update(status=Unit.Status.SOLD)
            Unit.objects.filter(id__in=units[int(n * 0.35): int(n * 0.45)]).update(status=Unit.Status.BOOKED)
            Unit.objects.filter(id__in=units[int(n * 0.45): int(n * 0.48)]).update(status=Unit.Status.NOT_FOR_SALE)
