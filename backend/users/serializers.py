from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import User, Organization, UserOrganization, OrganizationInvitation, APIKey, Webhook, WebhookDelivery
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data['message'] = "Login Berhasil."
        data['token'] = data.pop('access')
        data.pop('refresh', None)
        orgs = UserOrganization.objects.filter(user=user).select_related('organization')
        organizations = [
            {
                "org_id": uo.organization.org_id,
                "name": uo.organization.name,
                "role": uo.role,
                "subscription_plan": uo.organization.subscription_plan,
            }
            for uo in orgs
        ]

        data['user'] = {
            "user_id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email_verified": getattr(user, "email_verified", False),
            "organizations": organizations,
        }
        return data

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'username', 'password', 'confirm_password']

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Password tidak cocok.")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(**validated_data)

        org = Organization.objects.create(
            name=f"{user.first_name}'s Organization",
            owner_user=user
        )

        UserOrganization.objects.create(
            user=user,
            organization=org,
            role='admin'
        )

        return user
    
class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(email=email, password=password)

            if not user:
                raise serializers.ValidationError('Email atau password tidak valid.')
            
            if not user.is_active:
                raise serializers.ValidationError('Akun tidak aktif.')
            
            if not user.email_verified:
                raise serializers.ValidationError('Email belum terverifikasi.')
            
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('Email dan password diperlukan.')
        
class UserProfileSerializer(serializers.ModelSerializer):
    organizations = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['user_id', 'email', 'first_name', 'last_name', 'created_at',
                  'email_verified', 'organizations']
        read_only_fields = ['user_id', 'created_at', 'email_verified']

    def get_organizations(self, obj):
        user_orgs = UserOrganization.objects.filter(user=obj).select_related('organization')
        return [
            {
                'org_id': uo.organization.org_id,
                'name': uo.organization.name,
                'role': uo.role,
                'subscription_plan': uo.organization.subscription_plan
            }
            for uo in user_orgs
        ]
    
class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    confirm_new_password = serializers.CharField()
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Password lama tidak benar.')
        return value
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError('Password baru tidak cocok.')
        return attrs
    
class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetSerializer(serializers.Serializer):  # Bukan passwordResetSerializer
    token = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    confirm_new_password = serializers.CharField()

    def validate(self, attrs):
        # FIX: Spasi setelah attrs
        if attrs['new_password'] != attrs['confirm_new_password']:  # Bukan attrs ['confirm_new_password']
            raise serializers.ValidationError('Password baru tidak cocok.')
        return attrs
    
class OrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['org_id', 'name', 'subscription_plan', 'created_at', 'member_count']
        read_only_fields = ['org_id', 'created_at']
    def get_member_count(self, obj):
        return UserOrganization.objects.filter(organization=obj).count()
        
class OrganizationMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = UserOrganization  
        fields = ['user', 'user_email', 'user_name', 'role', 'joined_at']
        read_only_fields = ['user', 'joined_at']

class OrganizationInvitationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    invited_by_name = serializers.CharField(source='invited_by.get_full_name', read_only=True)

    class Meta:
        model = OrganizationInvitation
        fields = ['email', 'organization', 'role', 'organization_name',
                  'invited_by_name', 'created_at', 'expires_at']
        read_only_fields = ['organization_name', 'invited_by_name', 'created_at', 'expires_at']

class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['key_id', 'name', 'key_prefix', 'can_read', 'can_write', 
                 'can_delete', 'rate_limit', 'is_active', 'last_used_at', 
                 'created_at', 'expires_at']
        read_only_fields = ['key_id', 'key_prefix', 'last_used_at', 'created_at']

class APIKeyCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    can_read = serializers.BooleanField(default=True)
    can_write = serializers.BooleanField(default=True)
    can_delete = serializers.BooleanField(default=False)
    rate_limit = serializers.IntegerField(default=1000)
    expires_at = serializers.DateTimeField(required=False)

class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ['webhook_id', 'url', 'events', 'is_active', 'last_triggered_at',
                 'failure_count', 'created_at']
        read_only_fields = ['webhook_id', 'last_triggered_at', 'failure_count', 'created_at']

class WebhookDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = ['delivery_id', 'event_type', 'status', 'status_code', 
                 'created_at', 'delivered_at', 'retry_count', 'error_message']