from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Task, TaskComment, TaskSubmission


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
        NotificationService.notify_task_assigned(instance)
    elif not created:
        old_status = getattr(instance, '_old_status', None)
        old_assigned = getattr(instance, '_old_assigned_to', None)

        if old_assigned != instance.assigned_to_id and instance.assigned_to_id:
            NotificationService.notify_task_assigned(instance)

        if old_status != instance.status and instance.status == 'done':
            NotificationService.notify_task_completed(instance)


# Сигналы для комментариев
@receiver(post_save, sender=TaskComment)
def comment_post_save(sender, instance, created, **kwargs):
    if created:
        from apps.notifications.services import NotificationService
        NotificationService.notify_task_commented(instance)


# Сигналы для сдачи заданий
@receiver(post_save, sender=TaskSubmission)
def submission_post_save(sender, instance, created, **kwargs):
    from apps.notifications.services import NotificationService
    if created:
        NotificationService.notify_task_submitted(instance)
    else:
        # если статус изменился
        try:
            old = TaskSubmission.objects.get(pk=instance.pk)
            if old.status != instance.status:
                if instance.status == TaskSubmission.Status.APPROVED:
                    NotificationService.notify_task_approved(instance)
                elif instance.status == TaskSubmission.Status.REJECTED:
                    NotificationService.notify_task_rejected(instance)
        except TaskSubmission.DoesNotExist:
            pass