import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rubezh.settings')
# Важно инициализировать Django перед импортом маршрутов Channels
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from apps.tasks.consumers import TaskBoardConsumer
from apps.notifications.consumers import NotificationConsumer # <-- 1. ДОБАВЛЕН ИМПОРТ

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path("ws/tasks/", TaskBoardConsumer.as_asgi()),
            path("ws/notifications/", NotificationConsumer.as_asgi()), # <-- 2. ДОБАВЛЕН МАРШРУТ
        ])
    ),
})