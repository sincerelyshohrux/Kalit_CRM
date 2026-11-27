"""Yuklangan rasmlarni xavfsiz qayta ishlash.

Har bir rasm Pillow orqali qaytadan chiziladi va WebP formatida saqlanadi:
  * EXIF/GPS metama'lumotlari (telefon rasmlaridagi joylashuv!) o'chadi;
  * rasm ichiga yashirilgan "polyglot" yuklamalar (HTML/JS/ZIP) yo'qoladi;
  * juda katta o'lchamli "dekompressiya bombalari" ochilmasdan rad etiladi;
  * EXIF burilishi to'g'rilanadi, o'lcham cheklanadi, kichik nusxa (thumb) yasaladi.
"""

import uuid
from dataclasses import dataclass
from io import BytesIO

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps

from .validators import validate_image_file

MAX_PIXELS = 40_000_000  # ~ 8000×5000 — undan kattasi rad etiladi
ALLOWED_FORMATS = ("JPEG", "PNG", "WEBP")

# Pillow'ning global himoyasi ham shu chegarada ishlasin
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


@dataclass
class ProcessedImage:
    image: ContentFile
    thumb: ContentFile
    width: int
    height: int


def _encode(img: Image.Image, quality: int) -> ContentFile:
    buf = BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=4)
    return ContentFile(buf.getvalue(), name=f"{uuid.uuid4().hex}.webp")


def process_image(file, *, max_side: int = 2560, thumb_side: int = 640, quality: int = 82, max_mb: int | None = None) -> ProcessedImage:
    """Rasmni tekshiradi, tozalaydi va WebP (asosiy + thumb) qilib qaytaradi.

    Xato bo'lsa `django.core.exceptions.ValidationError` ko'taradi.
    """
    validate_image_file(file, max_mb=max_mb)
    file.seek(0)
    try:
        with Image.open(file, formats=ALLOWED_FORMATS) as src:
            if src.width * src.height > MAX_PIXELS:
                raise ValidationError("Rasm o'lchami juda katta (maks. 40 megapiksel).")
            if src.width < 64 or src.height < 64:
                raise ValidationError("Rasm juda kichik (kamida 64×64 piksel).")
            img = ImageOps.exif_transpose(src)
            has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
            img = img.convert("RGBA" if has_alpha else "RGB")
    except ValidationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError("Rasm o'lchami juda katta.")
    except Exception:
        raise ValidationError("Rasmni o'qib bo'lmadi — fayl buzilgan yoki formati noto'g'ri.")

    main = img.copy()
    main.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    thumb = img.copy()
    thumb.thumbnail((thumb_side, thumb_side), Image.Resampling.LANCZOS)
    return ProcessedImage(
        image=_encode(main, quality),
        thumb=_encode(thumb, max(quality - 6, 60)),
        width=main.width,
        height=main.height,
    )


def delete_files(*fields) -> None:
    """Model o'chirilganda unga tegishli fayllarni diskdan o'chiradi."""
    for f in fields:
        if f and f.name:
            f.storage.delete(f.name)
