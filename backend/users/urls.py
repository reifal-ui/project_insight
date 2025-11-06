from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # Authentication
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.CustomLoginView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', views.logout_view, name='logout'),

    # Email verification
    path('auth/verify-email/<str:token>/', views.verify_email, name='verify-email'),
    path('auth/resend-verification/', views.resend_verification, name='resend-verification'),

    # Password management
    path('auth/forgot-password/', views.forgot_password, name='forgot-password'),
    path('auth/reset-password/', views.reset_password, name='reset-password'),
    path('auth/change-password/', views.change_password, name='change-password'),

    # User profile
    path('profile/', views.ProfileView.as_view(), name='profile'),
    path('profile/delete/', views.delete_account, name='delete-account'),

    # Organizations
    path('organizations/', views.OrganizationListCreateView.as_view(), name='organization-list-create'),
    path('organizations/<int:org_id>/', views.OrganizationDetailView.as_view(), name='organization-detail'),
    
    # Organization members
    path('organizations/<int:org_id>/members/', views.organization_members, name='organization-members'),
    path('organizations/<int:org_id>/invite/', views.invite_user, name='invite-user'),
    path('organizations/<int:org_id>/members/<int:user_id>/', views.update_member_role, name='update-member-role'),
    path('organizations/<int:org_id>/members/<int:user_id>/remove/', views.remove_member, name='remove-member'),
    path('organizations/invitations/accept/', views.accept_invitation, name='accept-invitation'),

    # Subscriptions
    path('subscriptions/plans/', views.list_subscription_plan, name='list-plans'),
    path('organizations/<int:org_id>/subscription/', views.get_subscription_info, name='subscription-info'),
    path('organizations/<int:org_id>/subscription/change/', views.change_subscription_plan, name='change-subscription'),
    path('organizations/<int:org_id>/subscription/cancel/', views.cancel_subscription, name='cancel-subscription'),

    # API Keys
    path('api-keys/', views.APIKeyListView.as_view(), name='api-key-list'),
    path('api-keys/<str:key_id>/revoke/', views.revoke_api_key, name='revoke-api-key'),

    # Webhooks
    path('webhooks/', views.WebhookListView.as_view(), name='webhook-list'),
    path('webhooks/<str:webhook_id>/', views.WebhookDetailView.as_view(), name='webhook-detail'),
    path('webhooks/<str:webhook_id>/deliveries/', views.webhook_deliveries, name='webhook-deliveries'),
]