from rest_framework import serializers


class CompanyScopedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """FK maydoni: faqat joriy foydalanuvchi kompaniyasiga tegishli obyektlarni qabul qiladi.

    Boshqa kompaniyaning ID'si yuborilsa "mavjud emas" xatosi qaytadi —
    shu bilan IDOR (begona obyektga bog'lash) hujumining oldi olinadi.
    """

    def __init__(self, **kwargs):
        self.company_field = kwargs.pop("company_field", "company")
        super().__init__(**kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.context.get("request")
        if request is None or not getattr(request.user, "company_id", None):
            return qs.none()
        return qs.filter(**{self.company_field: request.user.company_id})


class MediaURLField(serializers.ImageField):
    """Rasm URL'ini nisbiy ko'rinishda (`/media/...`) qaytaradi.

    Absolyut URL Host sarlavhasidan quriladi — uni soxtalashtirib bo'ladi
    (host header injection); nisbiy URL esa har doim sayt domeniga ishora qiladi.
    """

    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
        except ValueError:
            return None
