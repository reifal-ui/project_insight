from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response as APIResponse
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from surveys.models import Survey
from .models import User, Organization, UserOrganization, OrganizationInvitation, APIKey, Webhook, WebhookDelivery
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, UserProfileSerializer,
    PasswordChangeSerializer, PasswordResetRequestSerializer, PasswordResetSerializer,
    OrganizationSerializer, OrganizationMemberSerializer, OrganizationInvitationSerializer,
    APIKeyCreateSerializer, APIKeySerializer, WebhookSerializer, WebhookDeliverySerializer,
    SubscriptionChangeSerializer, OrganizationSubscriptionSerializer
)
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer
# Create your views here.

class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = UserRegistrationSerializer(data=request.data)

    if serializer.is_valid():
        with transaction.atomic():
            user = serializer.save()
            token = user.generate_verification_token()
            verification_url = f'{settings.SITE_URL}/auth/verify-email/{token}'

            try:
                send_mail(
                    subject='Verifikasi Project Insight akun anda!',
                    message=f'Silakan verifikasi akun anda dengan mengklik tautan berikut: {verification_url}',
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@projectinsight.com'),
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as e:
                print(f"Error sending email: {e}")
            
            return APIResponse({
                'message': 'Registrasi berhasil! Silakan periksa email Anda untuk verifikasi akun.',
               'user_id': user.user_id,
               'email': user.email
            }, status=status.HTTP_201_CREATED)
    
    return APIResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    serializer = UserLoginSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.validated_data['user']
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=['last_login_ip'])
        token = Token.objects.get_or_create(user=user)
        login(request, user)

        return APIResponse({
            'message': 'Login Berhasil.',
            'token': token.key,
            'user': UserProfileSerializer(user).data
        }, status=status.HTTP_200_OK)
    return APIResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    try:
        request.user.auth_token.delete()
    except:
        pass
    logout(request)

    return APIResponse({
        'message': 'Logout berhasil.'
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def verify_email(request, token):
    try:
        user = User.objects.get(email_verification_token=token)
        user.verify_email()

        return APIResponse({
            'message': 'Email berhasil diverifikasi.'
        }, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return APIResponse({
            'error': 'Token verifikasi tidak valid.'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def resend_verification(request):
    email = request.data.get('email')

    try:
        user = User.objects.get(email=email)
        if user.email_verified:
            return APIResponse({
                'error': 'Email sudah terverifikasi.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token = user.generate_verification_token()
        verification_url = f"{settings.SITE_URL}/auth/verify-email/{token}"

        try:
            send_mail(
                subject='Verifikasi Project Insight akun anda!',
                message=f'Silakan verifikasi akun anda dengan mengklik tautan berikut: {verification_url}',
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@projectinsight.com'),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Error sending email: {e}")
        
        return APIResponse({
            'message': 'Tautan verifikasi telah dikirim)'
        }, status=status.HTTP_200_OK)
    
    except User.DoesNotExist:
        return APIResponse({
            'error': 'User tidak ditemukan.'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def forgot_password(request):
    serializer = PasswordResetRequestSerializer(data=request.data)

    if serializer.is_valid():
        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email=email)
            token = user.generate_password_reset_token()
            reset_url = f"{settings.SITE_URL}/auth/reset-password/{token}"

            try:
                send_mail(
                    subject='Reset your Project Insight password',
                    message=f'Click this link to reset your password: {reset_url}\n\nThis link will expire in 1 hour.',
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@projectinsight.com'),
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as e:
                print(f"Error sending email: {e}")
        
        except User.DoesNotExist:
            pass

        return APIResponse({
            'message': 'If an account with that email exists, a password reset link has been sent.'
        }, status=status.HTTP_200_OK)

    return APIResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    serializer = PasswordResetSerializer(data=request.data)

    if serializer.is_valid():
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user = User.objects.get(
                password_reset_token=token,
                password_reset_expires__gt=timezone.now()
            )

            user.set_password(new_password)
            user.password_reset_token = None
            user.password_reset_expires = None
            user.save()
            Token.objects.filter(user=user).delete()

            return APIResponse({
                'message': 'Berhasil untuk reset password.'
            }, status=status.HTTP_200_OK)
        
        except User.DoesNotExist:
            return APIResponse({
                'error': 'Token tidak valid atau telah kedaluwarsa.'
            }, status=status.HTTP_400_BAD_REQUEST)

    return APIResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data, context={'request': request})

    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        Token.objects.filter(user=user).delete()

        return APIResponse({
            'message': 'Password berhasil diubah. Silakan login kembali.'
        }, status=status.HTTP_200_OK)
    
    return APIResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_account(request):
    password = request.data.get('password')

    if not request.user.check_password(password):
        return APIResponse({
            'error': 'Password tidak valid.'
        }, status=status.HTTP_400_BAD_REQUEST)

    owned_orgs =  request.user.owned_organizations.all()
    for org in owned_orgs:
        org.delete()
    request.user.delete()

    return APIResponse({
        'message': 'Akun dan semua data terkait telah dihapus.'
    }, status=status.HTTP_200_OK)

class OrganizationListCreateView(generics.ListCreateAPIView):
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_org_ids = UserOrganization.objects.filter(
            user=self.request.user
        ).values_list('organization_id', flat=True)

        return Organization.objects.filter(org_id__in=user_org_ids)
    
    def perform_create(self, serializer):
        organization = serializer.save(owner_user=self.request.user)
        UserOrganization.objects.create(
            user=self.request.user,
            organization=organization,
            role='admin'
        )

class OrganizationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'org_id'

    def get_queryset(self):
        user_org_ids = UserOrganization.objects.filter(
            user=self.request.user
        ).values_list('organization_id', flat=True)
        
        return Organization.objects.filter(org_id__in=user_org_ids)
    
    def perform_update(self, serializer):
        organization = self.get_object()
        user_org = UserOrganization.objects.get(
            user=self.request.user,
            organization=organization
        )

        if user_org.role not in ['admin'] and organization.owner_user != self.request.user:
            raise permissions.PermissionDenied("Hanya admin organisasi yang dapat memperbarui organisasi.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner_user != self.request.user:
            raise permissions.PermissionDenied("Hanya pemilik organisasi yang dapat menghapus organisasi.")
        instance.delete()

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def organization_members(request, org_id):
    organization = get_object_or_404(Organization, org_id=org_id)

    try:
        UserOrganization.objects.get(user=request.user, organization=organization)
    except UserOrganization.DoesNotExist:
        return APIResponse({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    members = UserOrganization.objects.filter(organization=organization).select_related('user')
    serializer = OrganizationMemberSerializer(members, many=True)

    return APIResponse(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def invite_user(request, org_id):
    organization = get_object_or_404(Organization, org_id=org_id)

    try:
        user_org = UserOrganization.objects.get(user=request.user, organization=organization)
        if user_org.role not in ['admin'] and organization.owner_user != request.user:
            return APIResponse({
                'error': 'Hanya admin yang bisa invite users.'
            }, status=status.HTTP_403_FORBIDDEN)
    except UserOrganization.DoesNotExist:
        return APIResponse({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    serializer = OrganizationInvitationSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        role = serializer.validated_data.get('role', 'member')

        if User.objects.filter(email=email).exists():
            existing_user = User.objects.get(email=email)
            if UserOrganization.objects.filter(user=existing_user, organization=organization).exists():
                return APIResponse({
                    'error': 'User ini sudah menjadi anggota organisasi.'
                }, status=status.HTTP_400_BAD_REQUEST)   

        if OrganizationInvitation.objects.filter(email=email, organization=organization, is_accepted=False).exists():
            return APIResponse({
                'error': 'Undangan sudah dikirim ke email ini.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        invitation = OrganizationInvitation.objects.create(
            email=email,
            organization=organization,
            invited_by=request.user,
            role=role
        )
        invitation_url = f'{settings.SITE_URL}/organizations/invitations/accept/{invitation.token}'

        try:
            send_mail(
                subject=f'Undangan untuk bergabung dengan {organization.name}',
                message=f'Anda telah diundang untuk bergabung dengan {organization.name} as a {role}.\n\nKlik tautan berikut untuk menerima undangan: {invitation_url}',
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@projectinsight.com'),
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Error sending email: {e}")
        
        return APIResponse({
            'message': 'Undangan telah dikirim.',
            'invitation_id': invitation.id
        }, status=status.HTTP_201_CREATED)
    
    return APIResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def accept_invitation(request):
    token = request.data.get('token')

    if not token:
        return APIResponse({'error': 'Token diperlukan.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        invitation = OrganizationInvitation.objects.get(token=token, is_accepted=False)

        if invitation.is_expired():
            return APIResponse({'error': 'Undangan kadaluarsa'}, status=status.HTTP_400_BAD_REQUEST)
        
        user, created = User.objects.get_or_create(
            email=invitation.email,
            defaults={
                'first_name': invitation.email.split('@')[0],
                'last_name': '',
                'email_verified': True
            }
        )

        UserOrganization.objects.get_or_create(
            user=user,
            organization=invitation.organization,
            defaults={'role': invitation.role}
        )

        invitation.is_accepted = True
        invitation.save()

        return APIResponse({
            'message': 'Berhasil menerima undangan.',
            'organization': invitation.organization.name,
            'role': invitation.role
        }, status=status.HTTP_200_OK)
    
    except OrganizationInvitation.DoesNotExist:
        return APIResponse({'error': 'Token undangan tidak valid atau sudah diterima.'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_member_role(request, org_id, user_id):
    organization = get_object_or_404(Organization, org_id=org_id)
    target_user = get_object_or_404(User, user_id=user_id)

    try:
        requester_org = UserOrganization.objects.get(user=request.user, organization=organization)
        if requester_org.role not in ['admin'] and organization.owner_user != request.user:
            return APIResponse({
                'error': 'Hanya admin yang bisa mengubah peran anggota.'
            }, status=status.HTTP_403_FORBIDDEN)
    except UserOrganization.DoesNotExist:
        return APIResponse({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        target_org = UserOrganization.objects.get(user=target_user, organization=organization)
    except UserOrganization.DoesNotExist:
        return APIResponse({
            'error': 'User bukan anggota organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if organization.owner_user == target_user:
        return APIResponse({
            'error': 'Tidak dapat mengubah peran pemilik organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    new_role = request.data.get('role')
    if new_role not in ['admin', 'member', 'viewer']:
        return APIResponse({
            'error': 'Peran tidak valid.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    target_org.role = new_role
    target_org.save()

    return APIResponse({
        'message': 'Peran anggota berhasil diperbarui.',
        'user': target_user.email,
        'new_role': new_role
    }, status=status.HTTP_200_OK)

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def remove_member(request, org_id, user_id):
    organization = get_object_or_404(Organization, org_id=org_id)
    target_user = get_object_or_404(User, user_id=user_id)

    try:
        requester_org = UserOrganization.objects.get(user=request.user, organization=organization)
        if requester_org.role not in ['admin'] and organization.owner_user != request.user:
            return APIResponse({
                'error': 'Hanya admin yang bisa menghapus anggota.'
            }, status=status.HTTP_403_FORBIDDEN)
    except UserOrganization.DoesNotExist:
        return APIResponse({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)

    if organization.owner_user == target_user:
        return APIResponse({
            'error': 'Tidak dapat menghapus pemilik organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        target_org = UserOrganization.objects.get(user=target_user, organization=organization)
        target_org.delete()

        return APIResponse({
            'message': 'Anggota berhasil dihapus dari organisasi.',
        }, status=status.HTTP_200_OK)
    
    except UserOrganization.DoesNotExist:
        return APIResponse({
            'error': 'User bukan anggota organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
class APIKeyListView(generics.ListCreateAPIView):
    """List atau create API keys"""
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return APIKeyCreateSerializer
        return APIKeySerializer
    
    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.request.user,
            role='admin'
        ).values_list('organization_id', flat=True)
        
        return APIKey.objects.filter(organization_id__in=user_orgs)
    
    def create(self, request):
        serializer = APIKeyCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            user_org = UserOrganization.objects.filter(
                user=request.user,
                role='admin'
            ).first()
            
            if not user_org:
                return APIResponse({
                    'success': False,
                    'message': 'Harus menjadi admin organisasi'
                }, status=status.HTTP_403_FORBIDDEN)
            
            raw_key, key_hash, key_prefix, key_id = APIKey.generate_key()
            
            api_key = APIKey.objects.create(
                key_id=key_id,
                organization=user_org.organization,
                name=serializer.validated_data['name'],
                key_hash=key_hash,
                key_prefix=key_prefix,
                can_read=serializer.validated_data.get('can_read', True),
                can_write=serializer.validated_data.get('can_write', True),
                can_delete=serializer.validated_data.get('can_delete', False),
                rate_limit=serializer.validated_data.get('rate_limit', 1000),
                expires_at=serializer.validated_data.get('expires_at'),
                created_by=request.user
            )
            
            return APIResponse({
                'success': True,
                'message': 'API Key berhasil dibuat. Simpan key ini, tidak akan ditampilkan lagi!',
                'data': {
                    'api_key': raw_key,
                    'key_id': api_key.key_id,
                    'key_prefix': api_key.key_prefix
                }
            }, status=status.HTTP_201_CREATED)
        
        return APIResponse({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def revoke_api_key(request, key_id):
    """Revoke API key"""
    user_orgs = UserOrganization.objects.filter(
        user=request.user,
        role='admin'
    ).values_list('organization_id', flat=True)
    
    api_key = get_object_or_404(
        APIKey,
        key_id=key_id,
        organization_id__in=user_orgs
    )
    
    api_key.delete()
    
    return APIResponse({
        'success': True,
        'message': 'API Key berhasil di-revoke'
    }, status=status.HTTP_200_OK)

class WebhookListView(generics.ListCreateAPIView):
    """List atau create webhooks"""
    serializer_class = WebhookSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.request.user,
            role='admin'
        ).values_list('organization_id', flat=True)
        
        return Webhook.objects.filter(organization_id__in=user_orgs)
    
    def perform_create(self, serializer):
        user_org = UserOrganization.objects.filter(
            user=self.request.user,
            role='admin'
        ).first()
        
        serializer.save(
            organization=user_org.organization,
            created_by=self.request.user
        )

class WebhookDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, delete webhook"""
    serializer_class = WebhookSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'webhook_id'
    
    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.request.user,
            role='admin'
        ).values_list('organization_id', flat=True)
        
        return Webhook.objects.filter(organization_id__in=user_orgs)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def webhook_deliveries(request, webhook_id):
    """Get webhook delivery history"""
    webhook = get_object_or_404(Webhook, webhook_id=webhook_id)
    
    deliveries = WebhookDelivery.objects.filter(
        webhook=webhook
    ).order_by('-created_at')[:50]
    
    serializer = WebhookDeliverySerializer(deliveries, many=True)
    
    return APIResponse({
        'success': True,
        'data': serializer.data
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_subscription_plan(request):
    plans = [
        {
            'plan_name': 'starter',
            'display_name': 'Starter',
            'price': 0.00,
            'surveys_per_month': '3',
            'responses_per_survey': '100',
            'team_members': 1,
            'features': [
                'Basic survey creation',
                'CSV export',
                'Community support',
                'Email distribution'
            ]
        },
        {
            'plan_name': 'pro',
            'display_name': 'Pro',
            'price': 49.00,
            'surveys_per_month': '50',
            'responses_per_survey': '5,000',
            'team_members': 10,
            'features': [
                'Everything in Starter',
                'Custom branding',
                'Conditional logic',
                'API access & webhooks',
                'JSON export',
                'Email support',
                'Advanced analytics',
                'Email campaigns'
            ]
        },
        {
            'plan_name': 'enterprise',
            'display_name': 'Enterprise',
            'price': 299.00,
            'surveys_per_month': 'Unlimited',
            'responses_per_survey': '50,000+',
            'team_members': 50,
            'features': [
                'Everything in Pro',
                'White-labeling',
                'PDF export',
                'Priority 24/7 support',
                'Custom integrations',
                'Dedicated account manager',
                'SLA guarantee',
                'Advanced security'
            ]
        }
    ]
    
    return APIResponse({
        'success': True,
        'data': plans
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subscription_info(request, org_id):
    """Get current subscription info for organization"""
    try:
        user_org = UserOrganization.objects.get(
            user=request.user,
            organization__org_id=org_id
        )
        organization = user_org.organization
    except UserOrganization.DoesNotExist:
        return APIResponse({
            'success': False,
            'message': 'Tidak memiliki akses ke organisasi ini'
        }, status=status.HTTP_403_FORBIDDEN)
    
    serializer = OrganizationSubscriptionSerializer(organization)
    
    return APIResponse({
        'success': True,
        'data': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_subscription_plan(request, org_id):
    try:
        organization = Organization.objects.get(
            org_id=org_id,
            owner_user=request.user
        )
    except Organization.DoesNotExist:
        return APIResponse({
            'success': False,
            'message': 'Hanya owner yang bisa mengubah subscription'
        }, status=status.HTTP_403_FORBIDDEN)
    
    serializer = SubscriptionChangeSerializer(data=request.data)
    
    if not serializer.is_valid():
        return APIResponse({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    new_plan = serializer.validated_data['new_plan']
    old_plan = organization.subscription_plan

    if new_plan == 'starter':
        current_surveys = Survey.objects.filter(
            organization=organization,
            status__in=['draft', 'active']
        ).count()
        
        if current_surveys > 3:
            return APIResponse({
                'success': False,
                'message': f'Tidak bisa downgrade ke Starter. Anda memiliki {current_surveys} surveys aktif (limit: 3)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        current_team = UserOrganization.objects.filter(organization=organization).count()
        if current_team > 1:
            return APIResponse({
                'success': False,
                'message': f'Tidak bisa downgrade ke Starter. Anda memiliki {current_team} team members (limit: 1)'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    organization.subscription_plan = new_plan
    organization.subscription_status = 'active'
    organization.subscription_started_at = timezone.now()
    
    if new_plan != 'starter':
        organization.subscription_expires_at = timezone.now() + timedelta(days=30)
    else:
        organization.subscription_expires_at = None
    
    organization.save()
    
    try:
        send_mail(
            subject=f'Subscription Changed to {new_plan.title()}',
            message=f'Your subscription has been changed from {old_plan} to {new_plan}.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[request.user.email],
            fail_silently=True
        )
    except:
        pass
    
    return APIResponse({
        'success': True,
        'message': f'Subscription berhasil diubah ke {new_plan.title()}',
        'data': {
            'old_plan': old_plan,
            'new_plan': new_plan,
            'status': organization.subscription_status,
            'expires_at': organization.subscription_expires_at.isoformat() if organization.subscription_expires_at else None
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_subscription(request, org_id):
    """Cancel subscription (revert to starter)"""
    try:
        organization = Organization.objects.get(
            org_id=org_id,
            owner_user=request.user
        )
    except Organization.DoesNotExist:
        return APIResponse({
            'success': False,
            'message': 'Hanya owner yang bisa cancel subscription'
        }, status=status.HTTP_403_FORBIDDEN)
    
    if organization.subscription_plan == 'starter':
        return APIResponse({
            'success': False,
            'message': 'Sudah di plan Starter'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    old_plan = organization.subscription_plan
    
    # Set to starter plan
    organization.subscription_plan = 'starter'
    organization.subscription_status = 'canceled'
    organization.subscription_expires_at = timezone.now()
    organization.save()
    
    return APIResponse({
        'success': True,
        'message': f'Subscription {old_plan} telah dibatalkan. Akun akan kembali ke Starter plan.',
        'data': {
            'current_plan': 'starter',
            'status': 'canceled'
        }
    }, status=status.HTTP_200_OK)