"""Demo loyihalarga rasm, planirovka chizmalari va lokatsiya qo'shadi.

Real rasmlar kelguncha ishlatiladi. Rasmlar kodda chiziladi (apps.realty.demo_media)
va foydalanuvchi yuklagandek xavfsiz pipeline'dan o'tadi (WebP, EXIF'siz).

    python manage.py seed_media            # rasmi yo'q loyihalarga qo'shadi
    python manage.py seed_media --force    # demo rasmlarni qaytadan yaratadi
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.common.images import process_image
from apps.realty import demo_media
from apps.realty.models import Layout, Project, ProjectPhoto

DEMO_LOCATIONS = {
    "Yangi Hayot Residence": (
        "41.365210", "69.287540",
        [
            {"kind": "metro", "name": "Yunusobod", "distance_m": 650},
            {"kind": "school", "name": "42-maktab", "distance_m": 300},
            {"kind": "kindergarten", "name": "Quyoshcha bog'chasi", "distance_m": 220},
            {"kind": "mall", "name": "Mega Planet", "distance_m": 1400},
            {"kind": "park", "name": "Yunusobod bog'i", "distance_m": 900},
        ],
    ),
    "Mirobod Gardens": (
        "41.293120", "69.280410",
        [
            {"kind": "metro", "name": "Oybek", "distance_m": 500},
            {"kind": "hospital", "name": "Klinika", "distance_m": 800},
            {"kind": "park", "name": "Ankhor kanali", "distance_m": 450},
            {"kind": "market", "name": "Mirobod bozori", "distance_m": 1100},
        ],
    ),
}


class Command(BaseCommand):
    help = "Demo loyihalarga rasm, planirovka va lokatsiya qo'shadi"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Mavjud rasmlarni o'chirib, qaytadan yaratish")

    def handle(self, *args, force=False, **opts):
        projects = Project.objects.filter(name__in=DEMO_LOCATIONS.keys())
        if not projects:
            self.stdout.write("Demo loyihalar topilmadi — avval `seed_demo` ni ishga tushiring.")
            return
        for i, project in enumerate(projects):
            self._seed_project(project, seed=11 + i * 17, force=force)
        self.stdout.write(self.style.SUCCESS("Demo rasmlar tayyor."))

    @transaction.atomic
    def _seed_project(self, project, seed, force):
        lat, lng, nearby = DEMO_LOCATIONS[project.name]
        if force or project.latitude is None:
            project.latitude, project.longitude, project.nearby = lat, lng, nearby
            project.save(update_fields=["latitude", "longitude", "nearby", "updated_at"])

        if force:
            for photo in project.photos.all():
                photo.delete()  # post_delete signal fayllarni ham o'chiradi
        if not project.photos.exists():
            for order, (upload, kind, caption) in enumerate(demo_media.project_photo_set(seed), start=1):
                result = process_image(upload)
                ProjectPhoto.objects.create(
                    project=project, kind=kind, caption=caption, sort_order=order,
                    image=result.image, thumb=result.thumb, width=result.width, height=result.height,
                )
            self.stdout.write(f"  {project.name}: 6 ta rasm")

        layouts = Layout.objects.filter(project=project)
        count = 0
        for layout in layouts:
            if layout.image and not force:
                continue
            upload = demo_media.floor_plan_upload(layout.rooms, float(layout.area), seed=layout.id)
            result = process_image(upload, max_side=2400, thumb_side=720, quality=90)
            layout.image, layout.thumb = result.image, result.thumb
            layout.save(update_fields=["image", "thumb", "updated_at"])
            count += 1
        if count:
            self.stdout.write(f"  {project.name}: {count} ta planirovka chizmasi")
