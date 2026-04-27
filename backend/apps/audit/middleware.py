import logging

from .models import AuditLog

logger = logging.getLogger('security')

AUDIT_METHODS = ('POST', 'PUT', 'PATCH', 'DELETE')

CATEGORY_MAP = {
    '/api/v1/auth/': 'auth',
    '/api/v1/tasks/': 'tasks',
    '/api/v1/structure/': 'structure',
    '/api/v1/security/': 'security',
    '/api/v1/autoplan/': 'documents',
}


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_category(path):
    for prefix, cat in CATEGORY_MAP.items():
        if path.startswith(prefix):
            return cat
    return 'auth'


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.method in AUDIT_METHODS and request.path.startswith('/api/'):
            
            user = request.user if request.user.is_authenticated else None
          
            ip = get_client_ip(request)
            category = get_category(request.path)

            action = f'{request.method} {request.path} → {response.status_code}'

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
                    },
                )
            except Exception as e:
                logger.error(f'Audit log error: {e}')

        return response