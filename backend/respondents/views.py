from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response as APIResponse
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import ValidationError
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Sum
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import redirect

from users.models import UserOrganization
from surveys.models import Survey
from .models import ContactList, Contact, ContactImport, SurveyInvitation, EmailTemplate, EmailCampaign, InvitationTracking
from .serializers import (
    ContactListSerializer, ContactSerializer, ContactImportSerializer,
    ContactImportResultSerializer, EmailTemplateSerializer, 
    SurveyInvitationSerializer, BulkInvitationSerializer,
    EmailCampaignSerializer, EmailCampaignCreateSerializer,
    InvitationTrackingSerializer
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
        org_id = self.request.query_params.get('organization')
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
        organization = get_user_organization(self.request.user, org_id)

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
        return queryset.select_related('organization', 'created_by').prefetch_related('contact_lists')
    
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
            user=self.request.user
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

            return APIResponse({
                'success': True,
                'message': 'Import berhasil diproses',
                'data': result_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return APIResponse({
                'success': False,
                'message': 'Import gagal',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return APIResponse({
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

    return APIResponse({
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

                return APIResponse({
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
            return APIResponse({
                'success': False,
                'message': 'Gagal mengirim invitation',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    return APIResponse({
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
    
    # Basic stats
    total_contacts = Contact.objects.filter(organization=organization).count()
    active_contacts = Contact.objects.filter(organization=organization, is_active=True).count()
    subscribed_contacts = Contact.objects.filter(
        organization=organization, 
        status='subscribed', 
        is_active=True
    ).count()
    
    # Status breakdown
    status_breakdown = Contact.objects.filter(
        organization=organization
    ).values('status').annotate(count=Count('status'))
    
    # Contact lists count
    contact_lists_count = ContactList.objects.filter(organization=organization).count()
    
    # Recent imports
    recent_imports = ContactImport.objects.filter(
        organization=organization
    ).order_by('-started_at')[:5]
    recent_imports_data = ContactImportResultSerializer(recent_imports, many=True).data
    
    # Recent invitations sent
    recent_invitations = SurveyInvitation.objects.filter(
        survey__organization=organization
    ).select_related('survey', 'contact').order_by('-created_at')[:10]
    
    invitation_data = []
    for inv in recent_invitations:
        invitation_data.append({
            'invitation_id': str(inv.invitation_id),
            'contact_email': inv.contact.email,
            'survey_title': inv.survey.title,
            'status': inv.status,
            'sent_at': inv.sent_at.isoformat() if inv.sent_at else None
        })
    
    # Email campaign stats
    total_campaigns = EmailCampaign.objects.filter(organization=organization).count()
    sent_campaigns = EmailCampaign.objects.filter(
        organization=organization,
        status='sent'
    ).count()
    
    # Aggregate email stats
    email_stats = EmailCampaign.objects.filter(
        organization=organization,
        status='sent'
    ).aggregate(
        total_sent=Sum('emails_sent'),
        total_opened=Sum('emails_opened'),
        total_clicked=Sum('emails_clicked')
    )
    
    open_rate = 0
    click_rate = 0
    if email_stats['total_sent'] and email_stats['total_sent'] > 0:
        open_rate = round((email_stats['total_opened'] or 0) / email_stats['total_sent'] * 100, 2)
        click_rate = round((email_stats['total_clicked'] or 0) / email_stats['total_sent'] * 100, 2)
    
    return APIResponse({
        'success': True,
        'data': {
            'contacts': {
                'total': total_contacts,
                'active': active_contacts,
                'subscribed': subscribed_contacts,
                'status_breakdown': list(status_breakdown)
            },
            'contact_lists': {
                'total': contact_lists_count
            },
            'imports': {
                'recent': recent_imports_data
            },
            'invitations': {
                'recent': invitation_data
            },
            'campaigns': {
                'total': total_campaigns,
                'sent': sent_campaigns,
                'email_stats': {
                    'total_sent': email_stats['total_sent'] or 0,
                    'total_opened': email_stats['total_opened'] or 0,
                    'total_clicked': email_stats['total_clicked'] or 0,
                    'open_rate': open_rate,
                    'click_rate': click_rate
                }
            }
        }
    }, status=status.HTTP_200_OK)

class EmailCampaignListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EmailCampaignCreateSerializer
        return EmailCampaignSerializer
    
    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user = self.request.user
        ).values_list('organization_id', flat=True)

        return EmailCampaign.objects.filter(
            organization_id__in = user_orgs
        ).select_related('survey', 'created_by').order_by('-created_at')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == 'POST':
            user_org = UserOrganization.objects.filter(
                user = self.request.user,
                role = 'admin'
            ).first()
            context['organization'] = user_org.organization if user_org else None
            context['user'] = self.request.user
        return context

class EmailCampaignDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EmailCampaignSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'campaign_id'

    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.request.user
        ).values_list('organization_id', flat=True)
        
        return EmailCampaign.objects.filter(
            organization_id__in=user_orgs
        ).select_related('survey', 'created_by')

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_campaign(request, campaign_id):
    campaign = get_object_or_404(EmailCampaign, campaign_id=campaign_id)

    if campaign.status not in ['draft', 'scheduled']:
        return APIResponse({
            'success': False,
            'message': 'Campaign sudah terkirim atau sedang proses'
        }, status=status.HTTP_400_BAD_REQUEST)
    try:
        with transaction.atomic():
            campaign.status = 'sending'
            campaign.started_at = timezone.now()
            campaign.save()

            contacts = Contact.objects.filter(
                contact_lists__in=campaign.contact_lists.all(),
                is_active=True,
                status='subscribed'
            ).distinct()
            send_count = 0
            failed_count = 0

            for contact in contacts:
                try:
                    existing = SurveyInvitation.objects.filter(
                        survey=campaign.survey,
                        contact=contact
                    ).first()

                    if existing:
                        continue

                    subject = campaign.subject_line
                    message = campaign.message_body
                    replacements = {
                        '{first_name}': contact.first_name or '',
                        '{last_name}': contact.last_name or '',
                        '{email}': contact.email,
                        '{survey_title}': campaign.survey.title,
                    }

                    for key, value in replacements.items():
                        subject = subject.replace(key, value)
                        message = message.replace(key, value)
                    
                    invitation = SurveyInvitation.objects.create(
                        survey=campaign.survey,
                        contact=contact,
                        subject_line=subject,
                        message_body=message,
                        sender_email=campaign.sender_email,
                        sender_name=campaign.sender_name,
                        sent_by=request.user
                    )

                    survey_url = f"{getattr(settings, 'SITE_URL', 'http://localhost:8000')}/surveys/take/{campaign.survey.share_token}?invitation={invitation.tracking_token}"
                    message = message.replace('{survey_url}', survey_url)
                    
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[contact.email],
                        fail_silently=False
                    )
                    
                    invitation.status = 'sent'
                    invitation.sent_at = timezone.now()
                    invitation.save()
                    
                    InvitationTracking.objects.create(
                        invitation=invitation,
                        campaign=campaign
                    )
                    
                    sent_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    print(f"Failed to send to {contact.email}: {e}")
            
            campaign.emails_sent = sent_count
            campaign.emails_failed = failed_count
            campaign.emails_delivered = sent_count
            campaign.status = 'sent'
            campaign.completed_at = timezone.now()
            campaign.save()
            
            return APIResponse({
                'success': True,
                'message': 'Campaign berhasil dikirim',
                'data': {
                    'sent': sent_count,
                    'failed': failed_count
                }
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        campaign.status = 'failed'
        campaign.save()
        
        return APIResponse({
            'success': False,
            'message': f'Campaign gagal: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def campaign_analytics(request, campaign_id):
    campaign = get_object_or_404(EmailCampaign, campaign_id=campaign_id)  
    serializer = EmailCampaignSerializer(campaign)
    top_performers = InvitationTracking.objects.filter(
        campaign=campaign,
        opened_count__gt=0
    ).select_related('invitation__contact').order_by('-opened_count')[:10]
    
    top_data = [{
        'email': t.invitation.contact.email,
        'opened': t.opened_count,
        'clicked': t.clicked_count
    } for t in top_performers]
    
    return APIResponse({
        'success': True,
        'data': {
            'campaign': serializer.data,
            'top_performers': top_data
        }
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def track_email_open(request, tracking_token):
    try:
        invitation = SurveyInvitation.objects.get(tracking_token=tracking_token)
        tracking = InvitationTracking.objects.get_or_create(
            invitation=invitation
        )
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        ip_address = request.META.get('REMOTE_ADDR')
        tracking.record_open(user_agent, ip_address)
        
        if invitation.status == 'sent':
            invitation.status = 'opened'
            invitation.opened_at = timezone.now()
            invitation.save()
        
        if tracking.campaign:
            tracking.campaign.emails_opened += 1
            tracking.campaign.save()
        
        pixel = b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
        return HttpResponse(pixel, content_type='image/gif')
        
    except SurveyInvitation.DoesNotExist:
        return HttpResponse(status=404)

@api_view(['GET'])
@permission_classes([AllowAny])
def track_link_click(requset, tracking_token):
    try:
        invitation = SurveyInvitation.objects.get(tracking_token=tracking_token)
        tracking = InvitationTracking.objects.get_or_create(
            invitation=invitation
        )     
        tracking.record_click()

        if invitation.status in ['sent', 'opened']:
            invitation.status = 'clicked'
            invitation.clicked_at = timezone.now()
            invitation.save()
        
        if tracking.campaign:
            tracking.campaign.emails_clicked += 1
            tracking.campaign.save()
        
        survey_url = f"/surveys/take/{invitation.survey.share_token}/"
        return redirect(survey_url)
        
    except SurveyInvitation.DoesNotExist:
        return HttpResponse("Invalid tracking link", status=404)