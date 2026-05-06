from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KnowledgeDocumentViewSet

router = DefaultRouter()
router.register(r'', KnowledgeDocumentViewSet, basename='knowledge')

urlpatterns = [
    path('', include(router.urls)),
]