from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Task, TaskComment, TaskSubmission

# --- Функция-хелпер для отправки пинка в WebSocket ---
def trigger_board_update(action='update'):
    print(f"=== [СИГНАЛ] ЗАДАЧА ИЗМЕНИЛАСЬ. ПЫТАЮСЬ ОТПРАВИТЬ СИГНАЛ: {action} ===")
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            'kanban_board',
            {
                'type': 'task_update',
                'message': action
            }
        )
        print("=== [СИГНАЛ] СИГНАЛ УСПЕШНО ПЕРЕДАН В REDIS! ===")
    else:
        print("=== [СИГНАЛ] ОШИБКА: CHANNEL_LAYER НЕ НАЙДЕН! ===")

@receiver(pre_save, sender=Task)
def track_status_change(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = Task.objects.get(pk=instance.pk)
            instance._old_status = old.status
            instance._old_assigned_to = old.assigned_to_id
        except Task.DoesNotExist:
            instance._old_status = None
            instance._old_assigned_to = None
    else:
        instance._old_status = None
        instance._old_assigned_to = None

@receiver(post_save, sender=Task)
def task_post_save(sender, instance, created, **kwargs):
    from apps.notifications.services import NotificationService
    if created and instance.assigned_to_id:
        if hasattr(NotificationService, 'notify_task_assigned'):
            NotificationService.notify_task_assigned(instance)
    elif not created:
        old_status = getattr(instance, '_old_status', None)
        old_assigned = getattr(instance, '_old_assigned_to', None)
        if old_assigned != instance.assigned_to_id and instance.assigned_to_id:
            if hasattr(NotificationService, 'notify_task_assigned'):
                NotificationService.notify_task_assigned(instance)
        if old_status != instance.status and instance.status == 'done':
            if hasattr(NotificationService, 'notify_task_completed'):
                NotificationService.notify_task_completed(instance)
    
    # ФИКС: Оповещаем фронтенд о том, что задача изменилась/создалась
    trigger_board_update('task_saved')

@receiver(post_delete, sender=Task)
def task_post_delete(sender, instance, **kwargs):
    trigger_board_update('task_deleted')

@receiver(post_save, sender=TaskComment)
def comment_post_save(sender, instance, created, **kwargs):
    if created:
        from apps.notifications.services import NotificationService
        if hasattr(NotificationService, 'notify_task_commented'):
            NotificationService.notify_task_commented(instance)
    # ФИКС: Оповещаем фронтенд
    trigger_board_update('comment_added')

@receiver(post_save, sender=TaskSubmission)
def submission_post_save(sender, instance, created, **kwargs):
    from apps.notifications.services import NotificationService
    if created:
        if hasattr(NotificationService, 'notify_task_submitted'):
            NotificationService.notify_task_submitted(instance)
    else:
        try:
            old = TaskSubmission.objects.get(pk=instance.pk)
            if old.status != instance.status:
                is_approved = instance.status in ('approved', getattr(TaskSubmission.Status, 'APPROVED', 'approved'))
                is_rejected = instance.status in ('rejected', getattr(TaskSubmission.Status, 'REJECTED', 'rejected'))
                if is_approved and hasattr(NotificationService, 'notify_task_approved'):
                    NotificationService.notify_task_approved(instance)
                elif is_rejected and hasattr(NotificationService, 'notify_task_rejected'):
                    NotificationService.notify_task_rejected(instance)
        except TaskSubmission.DoesNotExist:
            pass
    # ФИКС: Оповещаем фронтенд
    trigger_board_update('submission_updated')