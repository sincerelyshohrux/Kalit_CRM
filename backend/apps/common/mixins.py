from apps.common.permissions import HasRole, IsCompanyMember


class CompanyScopedViewSetMixin:
    """Kompaniya ichidagi ViewSet'lar uchun tenant izolyatsiyasi.

    - queryset faqat foydalanuvchi kompaniyasining yozuvlari bilan cheklanadi;
    - yangi yozuv avtomatik joriy kompaniyaga biriktiriladi;
    - boshqa kompaniyaning obyektiga murojaat 404 qaytaradi.
    """

    permission_classes = [IsCompanyMember, HasRole]
    company_field = "company"

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(**{self.company_field: self.request.user.company})

    def perform_create(self, serializer):
        serializer.save(**{self.company_field: self.request.user.company})
