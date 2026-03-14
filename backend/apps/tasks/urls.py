from django.urls import path
from . import views

urlpatterns = [
    path('', views.TaskListCreateView.as_view(), name='task_list'),
    path('<int:pk>/', views.TaskDetailView.as_view(), name='task_detail'),
    path('<int:pk>/move/', views.TaskMoveView.as_view(), name='task_move'),
    path('<int:pk>/attachments/', views.TaskAttachmentUploadView.as_view(), name='task_attachments'),
    path('kanban/', views.KanbanBoardView.as_view(), name='kanban'),
    path('dashboard/', views.DashboardStatsView.as_view(), name='dashboard_stats'),
]