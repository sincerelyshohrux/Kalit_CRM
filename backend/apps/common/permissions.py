from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import Role


class IsSuperAdmin(BasePermission):
    """Faqat platforma egasi (Kalit jamoasi)."""

    message = "Bu amal faqat platforma administratori uchun."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == Role.SUPERADMIN)


class IsCompanyMember(BasePermission):
    """Faol kompaniyaga biriktirilgan xodim."""

    message = "Kompaniyangiz faol emas yoki obuna muddati tugagan."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.company_id):
            return False
        return user.company.is_usable


class HasRole(BasePermission):
    """`view.allowed_roles` (yoki yozish uchun `view.write_roles`) ro'yxatidagi rollar.

    Masalan:
        allowed_roles = [Role.DIRECTOR, Role.MANAGER]   # hamma amallar uchun
        write_roles = [Role.DIRECTOR]                   # POST/PUT/PATCH/DELETE uchun
    """

    message = "Sizning rolingiz bu amalga ruxsat bermaydi."

    def has_permission(self, request, view):
        role = getattr(request.user, "role", None)
        allowed = getattr(view, "allowed_roles", None)
        if allowed is not None and role not in allowed:
            return False
        if request.method not in SAFE_METHODS:
            write_roles = getattr(view, "write_roles", None)
            if write_roles is not None and role not in write_roles:
                return False
        return True
