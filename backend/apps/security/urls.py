from django.urls import path
from . import views

urlpatterns = [
    path('status/', views.SecurityStatusView.as_view(), name='security_status'),
]