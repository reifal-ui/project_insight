from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from .models import User, Organization, UserOrganization, OrganizationInvitation
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, UserProfileSerializer,
    PasswordChangeSerializer, PasswordResetRequestSerializer, PasswordResetSerializer,
    OrganizationSerializer, OrganizationMemberSerializer, OrganizationInvitationSerializer
)
# Create your views here.

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
            
            return Response({
                'message': 'Registrasi berhasil! Silakan periksa email Anda untuk verifikasi akun.',
               'user_id': user.user_id,
               'email': user.email
            }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    serializer = UserLoginSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.validated_data['user']
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=['last_login_ip'])
        token, created = Token.objects.get_or_create(user=user)
        login(request, user)

        return Response({
            'message': 'Login Berhasil.',
            'token': token.key,
            'user': UserProfileSerializer(user).data
        }, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    try:
        request.user.auth_token.delete()
    except:
        pass
    logout(request)

    return Response({
        'message': 'Logout berhasil.'
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def verify_email(request, token):
    try:
        user = User.objects.get(email_verification_token=token)
        user.verify_email()

        return Response({
            'message': 'Email berhasil diverifikasi.'
        }, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({
            'error': 'Token verifikasi tidak valid.'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def resend_verification(request):
    email = request.data.get('email')

    try:
        user = User.objects.get(email=email)
        if user.email_verified:
            return Response({
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
        
        return Response({
            'message': 'Tautan verifikasi telah dikirim)'
        }, status=status.HTTP_200_OK)
    
    except User.DoesNotExist:
        return Response({
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

        return Response({
            'message': 'If an account with that email exists, a password reset link has been sent.'
        }, status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

            return Response({
                'message': 'Berhasil untuk reset password.'
            }, status=status.HTTP_200_OK)
        
        except User.DoesNotExist:
            return Response({
                'error': 'Token tidak valid atau telah kedaluwarsa.'
            }, status=status.HTTP_400_BAD_REQUEST)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data, context={'request': request})

    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        Token.objects.filter(user=user).delete()

        return Response({
            'message': 'Password berhasil diubah. Silakan login kembali.'
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
        return Response({
            'error': 'Password tidak valid.'
        }, status=status.HTTP_400_BAD_REQUEST)

    owned_orgs =  request.user.owned_organizations.all()
    for org in owned_orgs:
        org.delete()
    request.user.delete()

    return Response({
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
        return Response({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    members = UserOrganization.objects.filter(organization=organization).select_related('user')
    serializer = OrganizationMemberSerializer(members, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def invite_user(request, org_id):
    organization = get_object_or_404(Organization, org_id=org_id)

    try:
        user_org = UserOrganization.objects.get(user=request.user, organization=organization)
        if user_org.role not in ['admin'] and organization.owner_user != request.user:
            return Response({
                'error': 'Hanya admin yang bisa invite users.'
            }, status=status.HTTP_403_FORBIDDEN)
    except UserOrganization.DoesNotExist:
        return Response({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    serializer = OrganizationInvitationSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        role = serializer.validated_data.get('role', 'member')

        if User.objects.filter(email=email).exists():
            existing_user = User.objects.get(email=email)
            if UserOrganization.objects.filter(user=existing_user, organization=organization).exists():
                return Response({
                    'error': 'User ini sudah menjadi anggota organisasi.'
                }, status=status.HTTP_400_BAD_REQUEST)   

        if OrganizationInvitation.objects.filter(email=email, organization=organization, is_accepted=False).exists():
            return Response({
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
        
        return Response({
            'message': 'Undangan telah dikirim.',
            'invitation_id': invitation.id
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def accept_invitation(request):
    token = request.data.get('token')

    if not token:
        return Response({'error': 'Token diperlukan.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        invitation = OrganizationInvitation.objects.get(token=token, is_accepted=False)

        if invitation.is_expired():
            return Response({'error': 'Undangan kadaluarsa'}, status=status.HTTP_400_BAD_REQUEST)
        
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

        return Response({
            'message': 'Berhasil menerima undangan.',
            'organization': invitation.organization.name,
            'role': invitation.role
        }, status=status.HTTP_200_OK)
    
    except OrganizationInvitation.DoesNotExist:
        return Response({'error': 'Token undangan tidak valid atau sudah diterima.'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_member_role(request, org_id, user_id):
    organization = get_object_or_404(Organization, org_id=org_id)
    target_user = get_object_or_404(User, user_id=user_id)

    try:
        requester_org = UserOrganization.objects.get(user=request.user, organization=organization)
        if requester_org.role not in ['admin'] and organization.owner_user != request.user:
            return Response({
                'error': 'Hanya admin yang bisa mengubah peran anggota.'
            }, status=status.HTTP_403_FORBIDDEN)
    except UserOrganization.DoesNotExist:
        return Response({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        target_org = UserOrganization.objects.get(user=target_user, organization=organization)
    except UserOrganization.DoesNotExist:
        return Response({
            'error': 'User bukan anggota organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if organization.owner_user == target_user:
        return Response({
            'error': 'Tidak dapat mengubah peran pemilik organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    new_role = request.data.get('role')
    if new_role not in ['admin', 'member', 'viewer']:
        return Response({
            'error': 'Peran tidak valid.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    target_org.role = new_role
    target_org.save()

    return Response({
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
            return Response({
                'error': 'Hanya admin yang bisa menghapus anggota.'
            }, status=status.HTTP_403_FORBIDDEN)
    except UserOrganization.DoesNotExist:
        return Response({
            'error': 'Acces denied'
        }, status=status.HTTP_403_FORBIDDEN)

    if organization.owner_user == target_user:
        return Response({
            'error': 'Tidak dapat menghapus pemilik organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        target_org = UserOrganization.objects.get(user=target_user, organization=organization)
        target_org.delete()

        return Response({
            'message': 'Anggota berhasil dihapus dari organisasi.',
        }, status=status.HTTP_200_OK)
    
    except UserOrganization.DoesNotExist:
        return Response({
            'error': 'User bukan anggota organisasi.'
        }, status=status.HTTP_400_BAD_REQUEST)