from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

from .models import Task

logger = logging.getLogger(__name__)

@shared_task
def move_planned_to_todo():
    """Переводит задачи из статуса planned в todo за 2 дня до дедлайна"""
    threshold = timezone.now() + timedelta(days=2)
    tasks = Task.objects.filter(
        status=Task.Status.PLANNED,
        deadline__lte=threshold,
        deadline__gte=timezone.now()
    )
    updated = tasks.update(status=Task.Status.TODO)
    if updated:
        logger.info(f'Moved {updated} planned tasks to todo')
    return updated