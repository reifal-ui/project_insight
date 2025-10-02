from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings

from users.models import UserOrganization
from surveys.models import Survey
from .models import ContactList, Contact, ContactImport, SurveyInvitation, EmailTemplate
from .serializers import (
    ContactListSerializer, ContactSerializer, ContactImportSerializer,
    ContactImportResultSerializer, EmailTemplateSerializer, 
    SurveyInvitationSerializer, BulkInvitationSerializer
)


# Create your views here.

def get_user_organization(user, org_id=None):
    if org_id:
        try:
            user_org = UserOrganization.objects.get(
                user=user,
                organization__org_id=org_id
            )
            return user_org.organization
        except UserOrganization.DoesNotExist:
            raise ValidationError("Tidak memiliki akses ke organisasi ini")
    else:
        user_org = UserOrganization.objects.filter(
            user=user,
            role='admin'
        ).first()

        if not user_org:
            raise ValidationError("User harus menjadi admin minimal satu organisasi")
        return user_org.organization

class ContactPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        return UserOrganization.objects.filter(
            user=request.user,
            organization=obj.organization
        ).exists()
    
class ContactListView(generics.ListCreateAPIView):
    serializer_class = ContactListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request_params.get('organization')
        user_orgs = UserOrganization.objects.filter(user=user).values_list('organization_id', flat=True)
        queryset = ContactList.objects.filter(organization_id__in=user_orgs)

        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset.select_related('created_by', 'organization').order_by('-created_at')
    
    def perform_create(self, serializer):
        org_id = self.request.data.get('organization_id')
        organization = get_user_organization(self.reqyest.user, org_id)

        serializer.save(
            organization=organization,
            created_by=self.request.user
        )

class ContactListDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ContactListSerializer
    permission_classes = [ContactPermission]
    lookup_field = 'list_id'

    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.request.user
        ).values_list('organization_id', flat=True)
        
        return ContactList.objects.filter(
            organization_id__in=user_orgs
        ).select_related('created_by', 'organization')

class ContactView(generics.ListCreateAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization')
        list_id = self.request.query_params.get('contact_list')
        user_orgs = UserOrganization.objects.filter(user=user).values_list('organization_id', flat=True)
        queryset = Contact.objects.filter(organization_id__in=user_orgs)

        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        if list_id:
            queryset = queryset.filter(contact_lists__list_id=list_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(company__icontains=search)
            )
        return queryset.elect_related('organization', 'created_by').prefetch_related('contact_lists')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        org_id = self.request.data.get('organization_id') if self.request.method == 'POST' else None
        context['organization'] = get_user_organization(self.request.user, org_id)
        context['created_by'] = self.request.user
        return context

class ContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ContactSerializer
    permision_classes = [ContactPermission]
    lookup_field = 'contact_id'

    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.reqeust.user
        ).values_list('organization_id', flat=True)

        return Contact.objects.filter(
            organization_id__in=user_orgs
        ).select_related('organization', 'created_by').prefetch_related('contact_lists')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['organization'] = self.get_object().organization
        return context

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_contacts(request):
    org_id = request.data.get('organization_id')
    organization = get_user_organization(request.user, org_id)
    serializer = ContactImportSerializer(
        data=request.data,
        context={
            'organization': organization,
            'imported_by': request.user
        }
    )

    if serializer.is_valid():
        try:
            import_result = serializer.save()
            result_serializer = ContactImportResultSerializer(import_result)

            return Response({
                'success': True,
                'message': 'Import berhasil diproses',
                'data': result_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Import gagal',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({
        'success': False,
        'message': 'Data tidak valid',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def import_history(request):
    org_id = request.query_params.get('organization')
    organization = get_user_organization(request.user, org_id)
    imports = ContactImport.objects.filter(
        organization=organization
    ).select_related('contact_list', 'imported_by').order_by('-started_at')
    serializer = ContactImportResultSerializer(imports, many=True)

    return Response({
        'success': True,
        'data': serializer.data
    }, status=status.HTTP_200_OK)

class EmailTemplateView(generics.ListCreateAPIView):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization')
        user_orgs = UserOrganization.objects.filter(user=user).values_list('organization_id', flat=True)
        queryset = EmailTemplate.objects.filter(organization_id__in=user_orgs)

        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        template_type = self.request.query_params.get('type')
        if template_type:
            queryset = queryset.filter(template_type=template_type)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset.select_related('created_by', 'organization').order_by('-created_at')
    
    def perform_create(self, serializer):
        org_id = self.request.data.get('organization_id')
        organization = get_user_organization(self.request.user, org_id)
        serializer.save(
            organization=organization,
            created_by=self.request.user
        )

class EmailTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EmailTemplateSerializer
    permission_classes = [ContactPermission]
    lookup_field = 'template_id'

    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.request.user
        ).values_list('organization_id', flat=True)
        
        return EmailTemplate.objects.filter(
            organization_id__in=user_orgs,
        ).select_related('created_by', 'organization')
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_bulk_invitations(request):
    org_id = request.data.get('organization_id')
    organization = get_user_organization(request.user, org_id)
    serializer = BulkInvitationSerializer(
        data=request.data,
        context={'organization': organization}
    )

    if serializer.is_valid():
        try:
            with transaction.atomic():
                survey = serializer.validated_data['survey_id']
                email_template = serializer.validated_data.get('email_template_id')
                contact_list_ids = serializer.validated_data.get('contact_list_ids', [])
                contact_ids = serializer.validated_data.get('contact_ids', [])
                contacts = Contact.objects.filter(
                    organization=organization,
                    is_active=True,
                    status='subscribed'
                )

                if contact_list_ids:
                    contacts = contacts.filter(contact_lists__list_id__in=contact_list_ids)
                if contact_ids:
                    contacts = contacts.filter(contact_id__in=contact_ids)
                contacts = contacts.distinct()
                
                invitations_created = 0
                invitations_failed = 0
                errors = []

                for contact in contacts:
                    try:
                        if SurveyInvitation.objects.filter(survey=survey, contact=contact).exists():
                            continue
                        if email_template:
                            subject, message = email_template.render_for_contact(contact, survey)
                        else:
                            subject = serializer.validated_data.get('subject_line', '')
                            message = serializer.validated_data.get('message_body', '')
                            context = {
                                'first_name': contact.first_name or '',
                                'last_name': contact.last_name or '',
                                'full_name': contact.get_full_name() or contact.email,
                                'survey_title': survey.title,
                                'organization_name': survey.organization.name,
                            }

                            for key, value in context.items():
                                placeholder = '{' + key + '}'
                                subject = subject.replace(placeholder, str(value))
                                message = message.replace(placeholder, str(value))
                        
                        invitation = SurveyInvitation.objects.create(
                            survey=survey,
                            contact=contact,
                            subject_line=subject,
                            message_body=message,
                            sender_email=serializer.validated_data.get('sender_email', ''),
                            sender_name=serializer.validated_data.get('sender_name', ''),
                            sent_by=request.user
                        )
                        if serializer.validated_data.get('send_immediately', True):
                            try:
                                send_mail(
                                    subject=subject,
                                    message=message,
                                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@projectinsight.com'),
                                    recipient_list=[contact.email],
                                    fail_silently=False
                                )

                                invitation.status = 'sent'
                                invitation.sent_at = timezone.now()
                                invitation.save()
                                contact.last_contacted = timezone.now()
                                contact.save(update_fields=['last_contacted'])
                                invitations_created += 1
                            
                            except Exception as email_error:
                                invitation.status = 'failed'
                                invitation.error_message = str(email_error)
                                invitation.save()
                                invitation_failed += 1
                                errors.append(f"Gagal kirim ke {contact.email}: {str(email_error)}")
                        else:
                            invitations_created += 1
                    except Exception as e:
                        invitations_failed += 1
                        errors.append(f"Gagal buat invitation untuk {contact.email}: {str(e)}")

                return Response({
                    'success': True,
                    'message': 'Bulk invitation berhasil diproses',
                    'data': {
                        'total_contacts': contacts.count(),
                        'invitations_created': invitations_created,
                        'invitations_failed': invitations_failed,
                        'errors': errors[:10]
                    }
                }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Gagal mengirim invitation',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    return Response({
        'success': False,
        'message': 'Data tidak valid',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

class SurveyInvitationView(generics.ListAPIView):
    serializer_class = SurveyInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        survey_id = self.request.query_params.get('survey')
        user_orgs = UserOrganization.objects.filter(user=user).values_list('organization_id', flat=True)
        queryset = SurveyInvitation.objects.filter(survey__organization_id__in=user_orgs)
        
        if survey_id:
            queryset = queryset.filter(survey__survey_id=survey_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset.select_related('survey', 'contact', 'sent_by').order_by('-created_at')

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contact_statistics(request):
    org_id = request.query_params.get('organization')
    organization = get_user_organization(request.user, org_id)
    total_contacts = Contact.objects.filter(organization=organization).count()
    active_contacts = Contact.objects.filter(organization=organization, is_active=True).count()
    subscribed_contacts = Contact.objects.filter(
        organization=organization, 
        status='subscribed', 
        is_active=True
    ).count()
    status_breakdown = Contact.objects.filter(
        organization=organization
    ).values('status').annotate(count=Count('status'))
    contact_lists_count = ContactList.objects.filter(organization=organization).count()
    recent_imports = ContactImport.objects.filter(
        organization=organization
    ).order_by('-started_at')[:5]
    recent_imports_data = ContactImportResultSerializer(recent_imports, many=True).data
    
    return Response({
        'success': True,
        'data': {
            'total_contacts': total_contacts,
            'active_contacts': active_contacts,
            'subscribed_contacts': subscribed_contacts,
            'contact_lists_count': contact_lists_count,
            'status_breakdown': list(status_breakdown),
            'recent_imports': recent_imports_data
        }
    }, status=status.HTTP_200_OK)