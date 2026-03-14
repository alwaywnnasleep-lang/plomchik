from django.urls import path
from . import views

urlpatterns = [
    path('logs/', views.AuditLogListView.as_view(), name='audit_logs'),
    path('stats/', views.AuditStatsView.as_view(), name='audit_stats'),
]