from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Organization, UserOrganization, OrganizationInvitation

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'first_name', 'last_name', 'email_verified', 'is_active', 'created_at']
    list_filter = ['email_verified', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['-created_at']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Email Verification', {'fields': ('email_verified', 'email_verification_token')}),
        ('Password Reset', {'fields': ('password_reset_token', 'password_reset_expires')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Timestamps', {'fields': ('created_at', 'last_login', 'last_login_ip')}),
    )
    readonly_fields = ['created_at', 'last_login']

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner_user', 'subscription_plan', 'member_count', 'created_at']
    list_filter = ['subscription_plan', 'created_at']
    search_fields = ['name', 'owner_user__email']
    
    def member_count(self, obj):
        return UserOrganization.objects.filter(organization=obj).count()
    member_count.short_description = 'Members'

@admin.register(UserOrganization)
class UserOrganizationAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'role', 'joined_at']
    list_filter = ['role', 'joined_at']
    search_fields = ['user__email', 'organization__name']

@admin.register(OrganizationInvitation)
class OrganizationInvitationAdmin(admin.ModelAdmin):
    list_display = ['email', 'organization', 'role', 'invited_by', 'is_accepted', 'created_at']
    list_filter = ['role', 'is_accepted', 'created_at']
    search_fields = ['email', 'organization__name']
