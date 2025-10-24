from rest_framework import permissions
from users.models import UserOrganization

class IsOrganizationMember(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        return UserOrganization.objects.filter(
            user=request.user,
            organization=obj.organization
        ).exists()

class IsOrganizationAdminOrOwner(permissions.BasePermission):
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        try:
            user_org = UserOrganization.objects.get(
                user=request.user,
                organization=obj.organization
            )
            return user_org.role == 'admin' or obj.organization.owner_user == request.user
        except UserOrganization.DoesNotExist:
            return False