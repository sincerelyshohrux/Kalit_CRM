from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.common.mixins import CompanyScopedViewSetMixin

from .models import Role, User
from .security import revoke_all_tokens
from .serializers import (
    ChangePasswordSerializer,
    EmployeeSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class LogoutView(APIView):
    """Refresh tokenni qora ro'yxatga qo'shadi."""

    @extend_schema(request={"application/json": {"type": "object", "properties": {"refresh": {"type": "string"}}}}, responses={205: None})
    def post(self, request):
        try:
            token = RefreshToken(request.data.get("refresh"))
            if str(token.get("user_id")) != str(request.user.pk):
                raise TokenError("boshqa foydalanuvchi tokeni")
            token.blacklist()
        except (TokenError, TypeError):
            return Response({"detail": "Token noto'g'ri yoki muddati o'tgan."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return UserSerializer if self.request.method == "GET" else MeUpdateSerializer

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        return Response(UserSerializer(request.user, context={"request": request}).data)


class ChangePasswordView(APIView):
    @extend_schema(request=ChangePasswordSerializer, responses={204: None})
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        # Boshqa qurilmalardagi barcha sessiyalar tugatiladi (access tokenlar CHECK_REVOKE_TOKEN orqali)
        revoke_all_tokens(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmployeeViewSet(
    CompanyScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Kompaniya xodimlari. Ko'rish — barcha xodimlar, o'zgartirish — faqat direktor.

    DELETE xodimni o'chirmaydi, balki bloklaydi (tarix saqlanib qolishi uchun).
    """

    queryset = User.objects.all()
    serializer_class = EmployeeSerializer
    write_roles = [Role.DIRECTOR]
    filterset_fields = ["role", "is_active"]
    search_fields = ["first_name", "last_name", "phone", "email"]
    ordering_fields = ["first_name", "date_joined", "last_login"]

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "O'zingizni bloklay olmaysiz."})
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        revoke_all_tokens(instance)
