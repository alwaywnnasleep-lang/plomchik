from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from .models import KnowledgeDocument
from .serializers import KnowledgeDocumentSerializer

class KnowledgeDocumentViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeDocument.objects.all().select_related('uploaded_by')
    serializer_class = KnowledgeDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser] 
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'description']

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get('file')
        file_kwargs = {}
        
        # Извлекаем данные файла из сырого объекта загрузки
        if file_obj:
            file_kwargs['file_name'] = getattr(file_obj, 'name', 'Файл')
            file_kwargs['file_size'] = getattr(file_obj, 'size', 0)
            
        user = self.request.user
        full_name = "Система"
        
        # Безопасно формируем имя пользователя
        if user and user.is_authenticated:
            # Сначала пробуем взять full_name, если такая функция/поле есть
            full_name = getattr(user, 'full_name', getattr(user, 'fullName', ''))
            
            # Если нет, склеиваем из last_name и first_name
            if not full_name:
                last = getattr(user, 'last_name', '')
                first = getattr(user, 'first_name', '')
                full_name = f"{last} {first}".strip()
                
            # Запасной вариант - username
            if not full_name:
                full_name = getattr(user, 'username', 'Сотрудник')

        # Сохраняем документ в БД
        serializer.save(
            uploaded_by=user if user.is_authenticated else None,
            uploaded_by_name=full_name,
            **file_kwargs
        )