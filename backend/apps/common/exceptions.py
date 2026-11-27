import logging

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("kalit.security")


def exception_handler(exc, context):
    """DRF exception handler:

    - Django ValidationError -> 400 (model.clean() xatolari);
    - IntegrityError -> 409, ichki SQL tafsilotlarisiz;
    - kutilmagan xatolar productionda ichki tafsilotni oshkor qilmaydi.
    """
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "error_dict") else {"detail": exc.messages}
        exc = ValidationError(detail)
    elif isinstance(exc, PermissionDenied):
        return Response({"detail": "Ruxsat yo'q."}, status=status.HTTP_403_FORBIDDEN)

    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, ProtectedError):
        return Response(
            {"detail": "Bu yozuvga boshqa ma'lumotlar bog'langan — o'chirib bo'lmaydi."},
            status=status.HTTP_409_CONFLICT,
        )

    if isinstance(exc, IntegrityError):
        logger.warning("IntegrityError: %s", exc)
        return Response(
            {"detail": "Ma'lumot boshqa yozuv bilan to'qnashdi (takroriy qiymat bo'lishi mumkin)."},
            status=status.HTTP_409_CONFLICT,
        )

    if settings.DEBUG:
        return None  # DEBUGda to'liq traceback
    logger.exception("Kutilmagan xato: %s", exc)
    return Response({"detail": "Serverda xatolik yuz berdi."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
