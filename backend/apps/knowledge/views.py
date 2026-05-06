from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from .models import KnowledgeDocument
from .serializers import KnowledgeDocumentSerializer

class KnowledgeDocumentViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeDocument.objects.all().select_related('uploaded_by')
    serializer_class = KnowledgeDocumentSerializer
    parser_classes = [MultiPartParser, FormParser] # Обязательно для загрузки файлов
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'description']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)