from django.urls import path
from . import views

urlpatterns = [
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/verify-email/', views.verify_email, name='verify-email'),
    path('auth/resend-verification/', views.resend_verification, name='resend-verification'),

    path ('auth/forgot-password/', views.forgot_password, name='forgot-password'),
    path('auth/reset-password/', views.reset_password, name='reset-password'),
    path('auth/change-password/', views.change_password, name='change-password'),

    path('profile/', views.ProfileView.as_view(), name='profile'),
    path('profile/delete/', views.delete_account, name='delete-account'),
]