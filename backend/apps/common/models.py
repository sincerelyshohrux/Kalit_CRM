from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("yaratilgan", auto_now_add=True)
    updated_at = models.DateTimeField("yangilangan", auto_now=True)

    class Meta:
        abstract = True


class CompanyScopedModel(TimeStampedModel):
    """Bitta kompaniyaga tegishli bo'lgan har qanday yozuv uchun asos.

    Keyingi bosqichlardagi barcha biznes modellari (loyiha, kvartira, mijoz,
    shartnoma...) shu klassdan meros oladi, shunda tenant izolyatsiyasi
    `CompanyScopedViewSetMixin` orqali avtomatik ishlaydi.
    """

    company = models.ForeignKey(
        "companies.Company",
        verbose_name="kompaniya",
        on_delete=models.CASCADE,
        related_name="+",
    )

    class Meta:
        abstract = True
