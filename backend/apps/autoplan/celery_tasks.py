from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger('apps')


@shared_task
def parse_uploaded_document(document_id):
    from .models import ParsedDocument
    from .parsers import parse_document

    try:
        doc = ParsedDocument.objects.get(id=document_id)
    except ParsedDocument.DoesNotExist:
        logger.error(f'Document {document_id} not found')
        return

    doc.status = 'parsing'
    doc.save()

    try:
        results = parse_document(doc.file.path, doc.file_type)
        doc.parsed_data = results
        doc.status = 'parsed'
        doc.save()
        logger.info(f'Parsed {doc.filename}: {len(results)} items')
    except Exception as e:
        doc.status = 'error'
        doc.error_message = str(e)
        doc.save()
        logger.error(f'Parse error {doc.filename}: {e}')


@shared_task
def check_approaching_deadlines():
    from apps.tasks.models import Task
    from apps.notifications.services import NotificationService

    now = timezone.now()
    window = now + timedelta(hours=24)

    tasks = Task.objects.filter(
        deadline__gte=now,
        deadline__lte=window,
        status__in=['planned', 'todo', 'in_progress'],
        assigned_to__isnull=False,
    ).select_related('assigned_to')

    for task in tasks:
        hours_left = int((task.deadline - now).total_seconds() / 3600)
        existing = task.notifications.filter(
            notification_type='deadline_approaching',
            created_at__gte=now - timedelta(hours=12),
        ).exists()
        if not existing:
            NotificationService.notify_deadline_approaching(task, hours_left)

    logger.info(f'Deadline check: {tasks.count()} tasks within 24h')