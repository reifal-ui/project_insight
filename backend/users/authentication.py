from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from .models import APIKey

class APIKeyAuthentication(BaseAuthentication):
    """Custom authentication using API Keys"""
    
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header.startswith('ApiKey '):
            return None
        
        raw_key = auth_header.replace('ApiKey ', '')
        
        if not raw_key:
            return None
        
        key_prefix = raw_key[:8]
        
        try:
            api_key = APIKey.objects.get(key_prefix=key_prefix, is_active=True)
            
            if not api_key.verify_key(raw_key):
                raise AuthenticationFailed('Invalid API key')
            
            if api_key.expires_at and api_key.expires_at < timezone.now():
                raise AuthenticationFailed('API key expired')
            
            api_key.last_used_at = timezone.now()
            api_key.save(update_fields=['last_used_at'])
            
            request.api_key = api_key
            
            return (api_key.organization.owner_user, None)
            
        except APIKey.DoesNotExist:
            raise AuthenticationFailed('Invalid API key')
    
    def authenticate_header(self, request):
        return 'ApiKey'