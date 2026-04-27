from rest_framework.permissions import BasePermission


class IsCommanderOrDeputy(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('commander', 'deputy_commander')


class IsHeadOrAbove(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ('commander', 'deputy_commander', 'department_head', 'group_head')