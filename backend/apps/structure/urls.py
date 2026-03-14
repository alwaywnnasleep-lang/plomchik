from django.urls import path
from . import views

urlpatterns = [
    path('tree/', views.OrgUnitTreeView.as_view(), name='org_tree'),
    path('units/', views.OrgUnitListCreateView.as_view(), name='unit_list'),
    path('units/<int:pk>/', views.OrgUnitDetailView.as_view(), name='unit_detail'),
    path('move-personnel/', views.MovePersonnelView.as_view(), name='move_personnel'),
    path('history/', views.StructureHistoryView.as_view(), name='structure_history'),
]