from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.DocumentUploadView.as_view(), name='doc_upload'),
    path('documents/', views.DocumentListView.as_view(), name='doc_list'),
    path('documents/<int:pk>/', views.DocumentDetailView.as_view(), name='doc_detail'),
    path('documents/<int:pk>/generate/', views.GenerateTasksView.as_view(), name='generate_tasks'),
    path('documents/<int:pk>/parse-sync/', views.ParseSyncView.as_view(), name='parse_sync'),
]