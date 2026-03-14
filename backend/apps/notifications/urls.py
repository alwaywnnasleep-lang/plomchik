from django.urls import path
from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification_list'),
    path('<int:pk>/read/', views.NotificationReadView.as_view(), name='notification_read'),
    path('read-all/', views.NotificationReadAllView.as_view(), name='notification_read_all'),
    path('<int:pk>/delete/', views.NotificationDeleteView.as_view(), name='notification_delete'),
    path('unread-count/', views.UnreadCountView.as_view(), name='unread_count'),
]