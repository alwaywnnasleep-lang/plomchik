import logging
from .models import AuditLog

logger = logging.getLogger('security')

# Логируем только те запросы, которые вносят изменения в систему
AUDIT_METHODS = ('POST', 'PUT', 'PATCH', 'DELETE')

class AuditMiddleware:
    """Middleware для автоматического логирования запросов"""
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Логирование только для API запросов, изменяющих данные
        if request.method in AUDIT_METHODS and request.path.startswith('/api/'):
            self.log_request(request, response)

        return response
    
    def log_request(self, request, response):
        user = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        ip = self.get_client_ip(request)
        category = self.get_category(request.path)
        action = f"{request.method} {request.path} → {response.status_code}"

        try:
            AuditLog.objects.create(
                user=user,
                action=action,
                category=category,
                ip_address=ip,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                details={
                    'method': request.method,
                    'path': request.path,
                    'status_code': response.status_code,
                    'query_params': dict(request.GET.items()),
                }
            )
        except Exception as e:
            logger.error(f'Audit log error: {e}')
    
    def get_category(self, path):
        # Гибкая проверка пути, независимая от наличия /v1/ или других префиксов
        if '/tasks/' in path:
            return 'tasks'
        elif '/structure/' in path:
            return 'structure'
        elif '/autoplan/' in path or '/documents/' in path:
            return 'documents'
        elif '/security/' in path:
            return 'security'
        # По умолчанию все операции с пользователями и токенами идут в auth
        return 'auth'
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')