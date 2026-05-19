from django.urls import path
from . import views

urlpatterns = [
    path('', views.TaskListCreateView.as_view(), name='task_list'),
    path('<int:pk>/', views.TaskDetailView.as_view(), name='task_detail'),
    path('<int:pk>/move/', views.TaskMoveView.as_view(), name='task_move'),
    path('<int:pk>/attachments/', views.TaskAttachmentUploadView.as_view(), name='task_attachments'),
    path('kanban/', views.KanbanBoardView.as_view(), name='kanban'),
    path('dashboard/', views.DashboardStatsView.as_view(), name='dashboard_stats'),
    path('archived/', views.TaskArchivedListView.as_view(), name='task_archived'),  # НОВЫЙ

    # Комментарии
    path('<int:task_pk>/comments/', views.CommentListCreateView.as_view(), name='comment_list'),
    path('comments/<int:pk>/', views.CommentDetailView.as_view(), name='comment_detail'),
    path('<int:task_pk>/comments/<int:comment_pk>/attachments/', views.CommentAttachmentUploadView.as_view(), name='comment_attachments'),
    path('update-planned/', views.UpdatePlannedTasksView.as_view(), name='update_planned'),
    # Сдача заданий
    path('<int:pk>/submit/', views.TaskSubmitView.as_view(), name='task_submit'),
    path('<int:pk>/approve/', views.TaskApproveView.as_view(), name='task_approve'),
    path('<int:pk>/reject/', views.TaskRejectView.as_view(), name='task_reject'),
    path('<int:pk>/submission-attachments/', views.SubmissionAttachmentUploadView.as_view(), name='submission_attachments'),
]