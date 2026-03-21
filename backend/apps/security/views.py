from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import datetime, timedelta
from threading import Timer

from apps.users.permissions import IsCommanderOrDeputy
from apps.audit.models import AuditLog


class ReminderService:
    reminders = []

    @staticmethod
    def add_reminder(event_time, message):
        delay = (event_time - datetime.now()).total_seconds()
        if delay > 0:
            Timer(delay, ReminderService.trigger_reminder, [message]).start()
            ReminderService.reminders.append({'time': event_time, 'message': message})

    @staticmethod
    def trigger_reminder(message):
        print(f"Reminder: {message}")


class SecurityStatusView(APIView):
    permission_classes = [IsCommanderOrDeputy]

    def get(self, request):
        now = timezone.now()
        security_events = AuditLog.objects.filter(
            category='security',
        ).count()

        data = {
            'overall_status': 'active',
            'checked_at': now.isoformat(),
            'encryption': {
                'status': 'active',
                'algorithm': 'AES-256-GCM',
                'key_length': 256,
                'mode': 'GCM',
                'key_rotation': '30 дней',
            },
            'network': {
                'status': 'active',
                'tls_version': 'TLS 1.3',
                'isolated_contour': True,
                'ids_ips': True,
                'firewall': True,
            },
            'access_control': {
                'status': 'active',
                'method': 'RBAC',
                'two_factor': False,
                'session_timeout_min': 30,
                'max_login_attempts': 5,
            },
            'audit': {
                'status': 'active',
                'total_events': security_events,
                'logging_enabled': True,
                'real_time_monitoring': True,
            },
            'backup': {
                'status': 'active',
                'frequency': 'Ежедневно',
            },
        }
        return Response(data)

    def post(self, request):
        event_time = request.data.get('event_time')
        message = request.data.get('message')
        if event_time and message:
            event_time = datetime.fromisoformat(event_time)
            ReminderService.add_reminder(event_time, message)
            return Response({'status': 'Reminder set successfully'})
        return Response({'error': 'Invalid data'}, status=400)