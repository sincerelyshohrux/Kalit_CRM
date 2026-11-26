import uuid
from pathlib import PurePath

from django.utils.deconstruct import deconstructible


@deconstructible
class upload_path:
    """Yuklangan fayl nomini tasodifiy UUID bilan almashtiradi.

    Asl nom (mijoz ismi, shartnoma raqami...) URL'da ko'rinmaydi va
    fayl nomlarini taxmin qilib bo'lmaydi.
    """

    def __init__(self, prefix: str):
        self.prefix = prefix.strip("/")

    def __call__(self, instance, filename: str) -> str:
        ext = PurePath(filename).suffix.lower()[:8]
        return f"{self.prefix}/{uuid.uuid4().hex}{ext}"
