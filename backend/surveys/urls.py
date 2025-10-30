from django.urls import path
from . import views

urlpatterns = [
    path('', views.SurveyListCreateView.as_view(), name='survey-list-create'),

    path('take/<str:share_token>/', views.get_public_survey, name='get-public-survey'),
    path('submit/<str:share_token>/', views.submit_survey_response, name='submit-survey-response'),

    path('<uuid:survey_id>/', views.SurveyDetailView.as_view(), name='survey-detail'),
    path('<uuid:survey_id>/duplicate/', views.duplicate_survey, name='duplicate-survey'),
    path('<uuid:survey_id>/publish/', views.publish_survey, name='publish-survey'),
    path('<uuid:survey_id>/close/', views.close_survey, name='close-survey'),
    path('<uuid:survey_id>/responses/', views.SurveyResponseListView.as_view(), name='survey-responses'),
    path('<uuid:survey_id>/analytics/', views.survey_analytics, name='survey-analytics'),
    path('<uuid:survey_id>/export/', views.export_survey_responses, name='export-responses'),
    path('<uuid:survey_id>/schedule/', views.schedule_survey, name='schedule-survey'),
    path('<uuid:survey_id>/cancel-schedule/', views.cancel_schedule, name='cancel-schedule'),
    path('dashboard/', views.dashboard_overview, name='dashboard-overview'),
    path('<uuid:survey_id>/response-rate/', views.survey_response_rate, name='survey-response-rate'),
]
