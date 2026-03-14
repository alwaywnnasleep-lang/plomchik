from .models import Notification


class NotificationService:
    @staticmethod
    def notify_task_assigned(task):
        if not task.assigned_to:
            return
        Notification.objects.create(
            user=task.assigned_to,
            notification_type='task_assigned',
            title='Новая задача',
            message=f'Вам назначена задача: «{task.title}»',
            related_task=task,
        )

    @staticmethod
    def notify_task_completed(task):
        if not task.created_by:
            return
        Notification.objects.create(
            user=task.created_by,
            notification_type='task_completed',
            title='Задача выполнена',
            message=f'Задача «{task.title}» выполнена.',
            related_task=task,
        )

    @staticmethod
    def notify_deadline_approaching(task, hours_left):
        if not task.assigned_to:
            return
        Notification.objects.create(
            user=task.assigned_to,
            notification_type='deadline_approaching',
            title='Приближается дедлайн',
            message=(
                f'До дедлайна задачи «{task.title}» осталось '
                f'{hours_left} ч.'
            ),
            related_task=task,
        )

    @staticmethod
    def notify_structure_change(user, message):
        Notification.objects.create(
            user=user,
            notification_type='structure_changed',
            title='Изменение структуры',
            message=message,
        )

    @staticmethod
    def notify_security_alert(user, message):
        Notification.objects.create(
            user=user,
            notification_type='security_alert',
            title='Предупреждение безопасности',
            message=message,
        )