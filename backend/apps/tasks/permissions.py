from rest_framework.permissions import BasePermission
from apps.structure.services import is_subordinate, get_units_under_authority


class CanCreateTask(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role in (
            'commander', 'deputy_commander',
            'department_head', 'group_head',
        )


class CanManageTask(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            if obj.assigned_to == user or obj.created_by == user:
                return True
            if obj.org_unit_id:
                return obj.org_unit_id in get_units_under_authority(user)
            return False
        if obj.created_by == user:
            return True
        if obj.assigned_to == user and request.method == 'PATCH':
            return True
        if obj.org_unit_id:
            return obj.org_unit_id in get_units_under_authority(user)
        return False


class CanAssignTo(BasePermission):
    def has_permission(self, request, view):
        if request.method not in ('POST', 'PUT', 'PATCH'):
            return True
        assigned_to_id = request.data.get('assigned_to')
        if not assigned_to_id:
            return True
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            target = User.objects.get(id=assigned_to_id)
        except User.DoesNotExist:
            return False
        return is_subordinate(request.user, target)


class CanCommentOnTask(BasePermission):
    """Право на комментирование задачи."""
    def has_permission(self, request, view):
        if request.method == 'GET':
            return True
        task_id = view.kwargs.get('task_pk')
        if not task_id:
            return False
        from .models import Task
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return False
        return self._has_access(request.user, task)

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return self._has_access(request.user, obj.task)
        # Редактировать/удалять может только автор
        return obj.user == request.user

    def _has_access(self, user, task):
        if user.role in ('commander', 'deputy_commander'):
            return True
        if task.assigned_to == user or task.created_by == user:
            return True
        if task.org_unit_id:
            return task.org_unit_id in get_units_under_authority(user)
        return False


class CanSubmitTask(BasePermission):
    """Право на сдачу задания."""
    def has_permission(self, request, view):
        task_id = view.kwargs.get('pk')
        if not task_id:
            return False
        from .models import Task
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return False
        return request.user == task.assigned_to and task.status == Task.Status.IN_PROGRESS


class CanReviewTask(BasePermission):
    """Право на проверку задания."""
    def has_permission(self, request, view):
        task_id = view.kwargs.get('pk')
        if not task_id:
            return False
        from .models import Task
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return False
        user = request.user
        if user.role in ('commander', 'deputy_commander'):
            return True
        if task.created_by == user:
            return True
        if task.org_unit_id:
            return task.org_unit_id in get_units_under_authority(user)
        return False