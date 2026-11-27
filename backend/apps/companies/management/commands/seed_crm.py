"""Demo mijozlar va bronlar (faqat DEBUG).

    python manage.py seed_crm

- Demo kompaniyaga voronkaning turli bosqichlaridagi mijozlarni qo'shadi;
- `seed_demo` "bron" qilib qo'ygan, lekin bron yozuvi yo'q xonadonlar uchun
  haqiqiy bron yaratadi (mijoz, menejer, muddat bilan).

Takroran ishga tushirish xavfsiz: telefon raqami bor mijozlar qayta yaratilmaydi.
"""

import random
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.companies.models import Company
from apps.crm.models import Booking, Client, ClientActivity
from apps.public.models import SiteSettings
from apps.realty.models import Project, Unit

FIRST = ["Aziz", "Bekzod", "Dilshod", "Jamshid", "Sherzod", "Otabek", "Sardor", "Ulug'bek", "Rustam", "Farrux",
         "Nodira", "Malika", "Gulnora", "Zarina", "Shahnoza", "Madina", "Kamola", "Nilufar", "Sevara", "Dildora"]
LAST = ["Karimov", "Toshmatov", "Rahimov", "Yusupov", "Aliyev", "Nazarov", "Ergashev", "Qodirov", "Saidov", "Xolmatov"]
NOTES = [
    "Oilasi bilan ko'rishga kelmoqchi",
    "Bo'lib to'lash shartlari bilan qiziqdi",
    "3 xonali, quyi qavatlarni xohlaydi",
    "Ipoteka orqali olmoqchi",
    "Instagramdagi reklamadan yozdi",
    "",
]

# (holat, soni)
PIPELINE = [("new", 8), ("contacted", 7), ("visited", 5), ("rejected", 3)]
REJECT_REASONS = ["Narx qimmatlik qildi", "Boshqa loyihani tanladi", "Hozircha rejasini kechiktirdi"]


class Command(BaseCommand):
    help = "Demo mijozlar va bronlar."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_crm faqat DEBUG rejimida ishlaydi.")
        company = Company.objects.filter(phone="+998712000000").first() or Company.objects.order_by("id").first()
        if not company:
            raise CommandError("Avval seed_demo ishga tushiring.")
        rnd = random.Random(7)
        sellers = list(User.objects.filter(company=company, role__in=[Role.MANAGER, Role.DIRECTOR], is_active=True))
        managers = [u for u in sellers if u.role == Role.MANAGER] or sellers
        projects = list(Project.objects.filter(company=company))
        phones = iter(f"+99893{n:07d}" for n in range(1_000_001, 9_999_999, 7919))

        def make_client(status: str) -> Client:
            while True:
                phone = next(phones)
                if not Client.objects.filter(company=company, phone=phone).exists():
                    break
            manager = rnd.choice(managers) if rnd.random() > 0.15 else None
            client = Client.objects.create(
                company=company,
                first_name=rnd.choice(FIRST),
                last_name=rnd.choice(LAST),
                phone=phone,
                source=rnd.choice(Client.Source.values),
                status=status,
                reject_reason=rnd.choice(REJECT_REASONS) if status == "rejected" else "",
                manager=manager,
                created_by=manager or sellers[0],
                interested_project=rnd.choice(projects) if projects and rnd.random() > 0.3 else None,
                budget=(b * 1_000_000) if (b := rnd.choice([None, 450, 600, 800, 1200])) else None,
                note=rnd.choice(NOTES),
            )
            ClientActivity.objects.create(company=company, client=client, kind="created", author=client.created_by, text=client.get_source_display())
            return client

        with transaction.atomic():
            created = 0
            if Client.objects.filter(company=company).count() < 5:
                for status, count in PIPELINE:
                    for _ in range(count):
                        make_client(status)
                        created += 1

            # seed_demo bron qilib qo'ygan, lekin bron yozuvi yo'q xonadonlar
            orphans = Unit.objects.filter(company=company, status=Unit.Status.BOOKED).exclude(
                bookings__status=Booking.Status.ACTIVE
            )
            booked = 0
            now = timezone.now()
            for unit in orphans.select_related("block"):
                client = make_client("booked")
                author = client.manager or rnd.choice(sellers)
                hours = rnd.randint(3, 72)
                booking = Booking.objects.create(
                    company=company, unit=unit, client=client, created_by=author,
                    expires_at=now + timedelta(hours=hours),
                    price_per_m2=unit.price_per_m2, total_price=unit.total_price,
                    note=rnd.choice(["", "Avans olib keladi", "Bank javobini kutmoqda"]),
                )
                ClientActivity.objects.create(
                    company=company, client=client, kind="booking_created", author=author,
                    text=f"{unit} · {max(1, hours // 24)} kun", booking=booking,
                )
                booked += 1

        site, _ = SiteSettings.objects.get_or_create(
            company=company,
            defaults={
                "slug": "toshkent-city",
                "is_enabled": True,
                "headline": "Toshkentning qoq markazida zamonaviy uylar",
                "about": "15 yildan beri Toshkentda turar-joy majmualari quramiz. Bo'lib to'lash, kalit topshirishgacha kafolat.",
                "phone": company.phone,
                "telegram": "toshkentcity_uy",
                "installment_min_down": 30,
                "installment_max_months": 24,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Mijozlar: +{created + booked}, bronlar: +{booked}, sayt: /{site.slug}"))
