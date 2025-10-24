from django.contrib import admin
from .models import ContactList, Contact, ContactImport, SurveyInvitation, EmailTemplate, EmailCampaign, InvitationTracking

@admin.register(ContactList)
class ContactListAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'contact_count', 'is_active', 'created_at']
    list_filter = ['is_active', 'organization', 'created_at']
    search_fields = ['name', 'organization__name']
    readonly_fields = ['list_id', 'created_at', 'updated_at']
    
    def contact_count(self, obj):
        return obj.contact_count

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['email', 'get_full_name', 'organization', 'status', 'created_at']  
    list_filter = ['status', 'organization', 'source', 'created_at']
    search_fields = ['email', 'first_name', 'last_name', 'company']
    readonly_fields = ['contact_id', 'created_at', 'updated_at']
    filter_horizontal = ['contact_lists']
    
    def get_full_name(self, obj):
        return obj.get_full_name() or '-'
    get_full_name.short_description = 'Name'

@admin.register(ContactImport)
class ContactImportAdmin(admin.ModelAdmin):
    list_display = ['filename', 'contact_list', 'status', 'success_rate', 'started_at']
    list_filter = ['status', 'contact_list__organization', 'started_at']
    search_fields = ['filename', 'contact_list__name']
    readonly_fields = ['import_id', 'started_at', 'completed_at']

@admin.register(SurveyInvitation)
class SurveyInvitationAdmin(admin.ModelAdmin):
    list_display = ['contact', 'survey', 'status', 'sent_at', 'responded_at']
    list_filter = ['status', 'survey__organization', 'sent_at']
    search_fields = ['contact__email', 'survey__title', 'subject_line']
    readonly_fields = ['invitation_id', 'tracking_token', 'created_at']

@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'template_type', 'organization', 'is_default', 'is_active']
    list_filter = ['template_type', 'is_default', 'is_active', 'organization']
    search_fields = ['name', 'subject_line', 'organization__name']
    readonly_fields = ['template_id', 'created_at', 'updated_at']

@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = ['name', 'survey', 'status', 'total_recipients', 'emails_sent', 
                   'open_rate', 'click_rate', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'survey__title']
    readonly_fields = ['campaign_id', 'total_recipients', 'emails_sent', 
                      'emails_delivered', 'emails_opened', 'emails_clicked', 
                      'emails_failed', 'created_at', 'started_at', 'completed_at']
    filter_horizontal = ['contact_lists']
    
    def open_rate(self, obj):
        return f"{obj.open_rate}%"
    
    def click_rate(self, obj):
        return f"{obj.click_rate}%"

@admin.register(InvitationTracking)
class InvitationTrackingAdmin(admin.ModelAdmin):
    list_display = ['invitation', 'campaign', 'opened_count', 'clicked_count', 
                   'first_opened_at', 'first_clicked_at']
    list_filter = ['campaign', 'first_opened_at']
    search_fields = ['invitation__contact__email']
    readonly_fields = ['tracking_id']