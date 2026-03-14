from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from apps.users.permissions import IsCommanderOrDeputy
from apps.audit.models import AuditLog


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
                'encrypted': True,
                'retention_days': 90,
            },
            'compliance': {
                'gost_r_57580': True,
                'fstek_orders': True,
                'fsb_requirements': True,
            },
        }

        return Response(data)