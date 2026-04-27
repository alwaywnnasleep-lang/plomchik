import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rubezh.settings')
app = Celery('rubezh')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'move-planned-to-todo': {
        'task': 'apps.tasks.tasks.move_planned_to_todo',
        'schedule': 3600.0,  # каждый час
    },
}