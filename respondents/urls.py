from django.urls import path
from . import views

urlpatterns = [
    path('contact-lists/', views.ContactListView.as_view(), name='contact-list-create'),
    path('contact-lists/<uuid:list_id>/', views.ContactListDetailView.as_view(), name='contact-list-detail'),
    path('contacts/', views.ContactView.as_view(), name='contact-list-create'),
    path('contacts/<uuid:contact_id>/', views.ContactDetailView.as_view(), name='contact-detail'),
    path('contacts/import/', views.import_contacts, name='import-contacts'),
    path('import-history/', views.import_history, name='import-history'),
    path('email-templates/', views.EmailTemplateView.as_view(), name='email-template-list-create'),
    path('email-templates/<uuid:template_id>/', views.EmailTemplateDetailView.as_view(), name='email-template-detail'),
    path('invitations/', views.SurveyInvitationView.as_view(), name='survey-invitations'),
    path('invitations/send-bulk/', views.send_bulk_invitations, name='send-bulk-invitations'),
    path('statistics/', views.contact_statistics, name='contact-statistics'),
    path('campaigns/', views.EmailCampaignListView.as_view(), name='campaign-list-create'),
    path('campaigns/<uuid:campaign_id>/', views.EmailCampaignDetailView.as_view(), name='campaign-detail'),
    path('campaigns/<uuid:campaign_id>/send/', views.send_campaign, name='send-campaign'),
    path('campaigns/<uuid:campaign_id>/analytics/', views.campaign_analytics, name='campaign-analytics'),
    path('track/open/<str:tracking_token>/', views.track_email_open, name='track-email-open'),
    path('track/click/<str:tracking_token>/', views.track_link_click, name='track-link-click'),
]