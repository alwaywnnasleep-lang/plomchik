from rest_framework.permissions import BasePermission
from .services import can_manage_unit


class CanManageStructure(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if not request.user.is_authenticated:
            return False
        # Разрешаем командиру, заместителю и начальнику отдела (для создания групп в своём отделе)
        return request.user.role in ('commander', 'deputy_commander', 'department_head')

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if not request.user.is_authenticated:
            return False
        return can_manage_unit(request.user, obj)