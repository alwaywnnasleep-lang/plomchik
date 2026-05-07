from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from .models import KnowledgeDocument
from .serializers import KnowledgeDocumentSerializer

class KnowledgeDocumentViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeDocument.objects.all().select_related('uploaded_by')
    serializer_class = KnowledgeDocumentSerializer
    
    # ДОБАВЛЕН JSONParser, чтобы не ломались запросы на редактирование без файлов (PATCH/PUT)
    parser_classes = [MultiPartParser, FormParser, JSONParser] 
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'description']

    def perform_create(self, serializer):
        # Извлекаем файл из запроса
        file_obj = self.request.FILES.get('file')
        file_kwargs = {}
        
        # Если файл есть, автоматически прописываем его размер и оригинальное имя
        if file_obj:
            file_kwargs['file_name'] = file_obj.name
            file_kwargs['file_size'] = file_obj.size
            
        # Сохраняем в базу вместе с текущим пользователем и метаданными файла
        serializer.save(uploaded_by=self.request.user, **file_kwargs)