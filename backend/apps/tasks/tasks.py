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

@shared_task
def archive_completed_tasks():
    """Переводит выполненные задачи в архив через 3 дня после сдачи"""
    threshold = timezone.now() - timedelta(days=3)
    
    tasks_to_archive = Task.objects.filter(
        status=Task.Status.DONE,
        updated_at__lte=threshold,
        is_archived=False
    )
    
    archived_count = tasks_to_archive.update(is_archived=True)
    if archived_count > 0:
        logger.info(f'Автоматически отправлено в архив задач: {archived_count}')
        
    return archived_count