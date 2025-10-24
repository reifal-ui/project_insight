from django.contrib import admin
from .models import Survey, Question, QuestionOption, Response, ResponseAnswer, SurveyTheme, SurveyAnalytics

# Register your models here.

@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ['title', 'organization', 'created_by', 'status', 'response_count', 'created_at']
    list_filter = ['status', 'is_public', 'organization']
    search_fields = ['title', 'organization__name']
    readonly_fields = ['survey_id', 'share_token', 'created_at', 'updated_at']

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['question_text_short', 'survey', 'question_type', 'order']
    list_filter = ['question_type', 'is_required']

    def question_text_short(self, obj):
        return obj.question_text[:50] + "..." if len(obj.question_text) > 50 else obj.question_text
    
@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    list_display = ['response_id', 'survey', 'respondent_email', 'is_completed', 'submitted_at']
    list_filter = ['is_completed', 'submitted_at']
    readonly_fields = ['response_id', 'started_at']

admin.site.register(ResponseAnswer)
admin.site.register(SurveyTheme)
admin.site.register(SurveyAnalytics)