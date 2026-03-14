from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta

from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.users.permissions import IsCommanderOrDeputy


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsCommanderOrDeputy]
    filterset_fields = ['category', 'user']
    search_fields = ['action', 'ip_address']
    ordering_fields = ['created_at', 'category']

    def get_queryset(self):
        return AuditLog.objects.select_related('user').all()


class AuditStatsView(APIView):
    permission_classes = [IsCommanderOrDeputy]

    def get(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total = AuditLog.objects.count()
        today = AuditLog.objects.filter(created_at__gte=today_start).count()
        security_warnings = AuditLog.objects.filter(
            category='security',
            created_at__gte=now - timedelta(days=7),
        ).count()

        return Response({
            'total': total,
            'today': today,
            'security_warnings': security_warnings,
        })