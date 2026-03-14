from django.db import models
from django.conf import settings
from django.contrib.postgres.fields import JSONField
from django.contrib.postgres.indexes import GinIndex

class AuditLog(models.Model):
    CATEGORY_CHOICES = [
        ('auth', 'Авторизация'),
        ('tasks', 'Задачи'),
        ('structure', 'Оргструктура'),
        ('security', 'Безопасность'),
        ('documents', 'Документы'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Пользователь',
        related_name='audit_logs'
    )
    action = models.CharField('Действие', max_length=500)
    category = models.CharField('Категория', max_length=20, choices=CATEGORY_CHOICES, default='auth')
    ip_address = models.GenericIPAddressField('IP адрес', null=True, blank=True)
    user_agent = models.CharField('User Agent', max_length=500, blank=True, default='')
    details = models.JSONField('Детали', default=dict)
    created_at = models.DateTimeField('Время', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Запись аудита'
        verbose_name_plural = 'Журнал аудита'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['category', '-created_at']),
            models.Index(fields=['ip_address']),
            GinIndex(fields=['details']),
        ]
    
    def __str__(self):
        return f"[{self.created_at}] {self.user} - {self.action[:50]}"


class AuditMiddleware:
    """Middleware для автоматического логирования запросов"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Логирование только для API запросов
        if request.path.startswith('/api/'):
            self.log_request(request, response)
        
        return response
    
    def log_request(self, request, response):
        if request.user.is_authenticated:
            AuditLog.objects.create(
                user=request.user,
                action=f"{request.method} {request.path}",
                category=self.get_category(request.path),
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                details={
                    'method': request.method,
                    'path': request.path,
                    'status_code': response.status_code,
                    'query_params': dict(request.GET.items()),
                }
            )
    
    def get_category(self, path):
        if '/tasks/' in path:
            return 'tasks'
        elif '/structure/' in path:
            return 'structure'
        elif '/auth/' in path:
            return 'auth'
        elif '/documents/' in path:
            return 'documents'
        return 'security'
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')