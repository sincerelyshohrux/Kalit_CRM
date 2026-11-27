from django.core.management.base import BaseCommand

from apps.crm.services import expire_overdue_bookings


class Command(BaseCommand):
    help = "Muddati o'tgan bronlarni yopadi va xonadonlarni bo'shatadi (cron: har 5–10 daqiqada)."

    def handle(self, *args, **options):
        total = 0
        while True:
            done = expire_overdue_bookings()
            total += done
            if done == 0:
                break
        self.stdout.write(self.style.SUCCESS(f"Yopilgan bronlar: {total}"))
