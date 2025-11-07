from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response as APIResponse
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Avg, Sum
from django.db import transaction
from django.http import HttpResponse
import csv
from datetime import timedelta
from django.db.models.functions import TruncDate
from users.webhook_sender import send_webhook

from users.models import UserOrganization, Organization
from .models import Survey, Question, QuestionOption, Response, ResponseAnswer, SurveyAnalytics
from .serializers import (
    SurveyListSerializer, SurveyDetailSerializer, SurveyPublicSerializer,
    QuestionSerializer, ResponseSerializer, ResponseSubmissionSerializer,
    SurveyDuplicateSerializer, SurveyAnalyticsSerializer
)

# Create your views here.

class SurveyPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    def has_object_permission(self, request, view, obj):
        try:
            user_org = UserOrganization.objects.get(
                user=request.user,
                organization=obj.organization
            )

            if request.method in permissions.SAFE_METHODS:
                return True
            if user_org.role == 'admin' or obj.organization.owner_user == request.user:
                return True
            if obj.created_by == request.user:
                return True
        except UserOrganization.DoesNotExist:
            pass
        return False

class SurveyListCreateView(generics.ListCreateAPIView):
    serializer_class = SurveyListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_id = self.request.query_params.get('organization')
        
        # Get user's organizations
        user_orgs = UserOrganization.objects.filter(user=user).values_list('organization_id', flat=True)
        
        # Filter surveys by user's organizations
        queryset = Survey.objects.filter(organization_id__in=user_orgs)

        # Optional: Filter by specific organization
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        # Optional: Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Optional: Search by title
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(title__icontains=search)
        
        # Return optimized queryset
        return queryset.select_related('created_by', 'organization').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SurveyDetailSerializer
        return SurveyListSerializer
    
    def perform_create(self, serializer):
        org_id = self.request.data.get('organization_id')

        if org_id:
            organization = get_object_or_404(
                Organization.objects.filter(
                    org_id=org_id,
                    userorganization__user=self.request.user
                )
            )
        else:
            user_org = UserOrganization.objects.filter(
                user=self.request.user,
                role='admin'
            ).first()

            if not user_org:
                raise ValidationError("User harus menjadi admin minimal satu organisasi")
            organization = user_org.organization
        
        # CHECK SUBSCRIPTION LIMITS
        if not organization.can_create_survey():
            survey_limit = organization.get_survey_limit()
            raise ValidationError(
                f"Limit survey tercapai! Plan {organization.subscription_plan.title()} "
                f"hanya bisa membuat {survey_limit} surveys per bulan. "
                f"Upgrade plan untuk membuat lebih banyak survey."
            )

        # Create survey
        survey = serializer.save(
            created_by=self.request.user,
            organization=organization
        )
        
        # Increment survey count
        organization.increment_survey_count()

class SurveyDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SurveyDetailSerializer
    permission_classes = [SurveyPermission]
    lookup_field = 'survey_id'

    def get_queryset(self):
        user_orgs = UserOrganization.objects.filter(
            user=self.request.user
        ).values_list('organization_id', flat=True)

        return Survey.objects.filter(
            organization_id__in=user_orgs
        ).select_related('created_by', 'organization').prefetch_related('questions__options', 'theme')
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def duplicate_survey(request, survey_id):
    original_survey = get_object_or_404(
        Survey.objects.filter(
            survey_id=survey_id,
            organization__userorganization__user=request.user
        )
    )

    org_id = request.data.get('organization_id', original_survey.organization.org_id)
    organization = get_object_or_404(
        Organization.objects.filter(
            org_id=org_id,
            userorganization__user=request.user,
            userorganization__role='admin'
        )
    )

    serializer = SurveyDuplicateSerializer(
        data=request.data,
        context={
            'original_survey': original_survey,
            'user': request.user,
            'organization': organization
        }
    )

    if serializer.is_valid():
        new_survey = serializer.save()
        return APIResponse({
            'success': True,
            'message': 'Survey berhasil diduplikasi',
            'data': {
                'survey_id': str(new_survey.survey_id),
                'title': new_survey.title
            }
        }, status=status.HTTP_201_CREATED)
    
    return APIResponse({
        'success': False,
        'message': 'Gagal menduplikasi survey',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publish_survey(request, survey_id):
    survey = get_object_or_404(
        Survey.objects.filter(
            survey_id=survey_id,
            organization__userorganization__user=request.user
        )
    )

    permission = SurveyPermission()
    if not permission.has_object_permission(request, None, survey):
        return APIResponse({
            'success': False,
            'message': 'Tidak memiliki izin untuk mempublikasi survey ini'
        }, status=status.HTTP_403_FORBIDDEN)
    
    if not survey.questions.exists():
        return APIResponse({
            'success': False,
            'message': 'Survey harus memiliki minimal 1 pertanyaan'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    survey.status = 'active'
    survey.published_at = timezone.now()
    survey.save(update_fields=['status', 'published_at'])

    webhook_payload = {
    'survey_id': str(survey.survey_id),
    'title': survey.title,
    'status': survey.status,
    'published_at': survey.published_at.isoformat()
    }
    send_webhook(survey.organization, 'survey.published', webhook_payload)

    return APIResponse({
        'success': True,
        'message': 'Survey berhasil dipublikasi',
        'data': {
            'status': survey.status,
            'published_at': survey.published_at,
            'share_url': f"/surveys/take/{survey.share_token}"
        }
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_survey(request, survey_id):
    survey = get_object_or_404(
        Survey.objects.filter(
            survey_id=survey_id,
            organization__userorganization__user=request.user
        )
    )

    permission = SurveyPermission()
    if not permission.has_object_permission(request, None, survey):
        return APIResponse({
            'success': False,
            'message': 'Tidak memiliki izin untuk menutup survey ini'
        }, status=status.HTTP_403_FORBIDDEN)
    
    survey.status = 'closed'
    survey.closes_at = timezone.now()
    survey.save(update_fields=['status', 'closes_at'])
    analytics, created = SurveyAnalytics.objects.get_or_create(survey=survey)
    analytics.recalculate()

    webhook_payload = {
    'survey_id': str(survey.survey_id),
    'title': survey.title,
    'status': survey.status,
    'closed_at': survey.closes_at.isoformat(),
    'total_responses': survey.responses.count()
    }
    send_webhook(survey.organization, 'survey.closed', webhook_payload)

    return APIResponse({
        'success': True,
        'message': 'Survey berhasil ditutup',
        'data': {
            'status': survey.status,
            'closes_at': survey.closes_at
        }
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_public_survey(request, share_token):
    try:
        survey = Survey.objects.select_related('organization').prefetch_related(
            'questions__options', 'theme'
        ).get(
            share_token=share_token,
            status='active',
            is_public=True
        )

        if not survey.is_active:
            return APIResponse({
                'success': False,
                'message': 'Survey tidak tersedia saat ini'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = SurveyPublicSerializer(survey)
        return APIResponse({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    except Survey.DoesNotExist:
        return APIResponse({
            'success': False,
            'message': 'Survey tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)
    
@api_view(['POST'])
@permission_classes([AllowAny])
def submit_survey_response(request, share_token):
    try:
        survey = Survey.objects.get(
            share_token=share_token,
            status='active',
            is_public=True
        )

        if not survey.is_active:
            return APIResponse({
                'success': False,
                'message': 'Survey tidak menerima respon saat ini'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ResponseSubmissionSerializer(
            data=request.data,
            context={'survey': survey, 'request': request}
        )

        if serializer.is_valid():
            with transaction.atomic():
                response = serializer.save()
                analytics, created = SurveyAnalytics.objects.get_or_create(survey=survey)
                analytics.recalculate()

                webhook_payload = {
                'response_id': str(response.response_id),
                'survey_id': str(survey.survey_id),
                'survey_title': survey.title,
                'respondent_email': response.respondent_email or 'anonymous',
                'is_completed': response.is_completed,
                'submitted_at': response.submitted_at.isoformat() if response.submitted_at else None,
                'completion_time_seconds': response.completion_time_seconds
            }
            send_webhook(survey.organization, 'response.new', webhook_payload)
            
            return APIResponse({
                'success': True,
                'message': 'Respon berhasil dikirim',
                'data': {
                    'response_id': str(response.response_id),
                    'completion_time_seconds': response.completion_time_seconds
                }
            }, status=status.HTTP_201_CREATED)
        
        return APIResponse({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    except Survey.DoesNotExist:
        return APIResponse({
            'success': False,
            'message': 'Survey tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)
    
class SurveyResponseListView(generics.ListAPIView):
    serializer_class = ResponseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        survey_id = self.kwargs['survey_id']
        survey = get_object_or_404(
            Survey.objects.filter(
                survey_id=survey_id,
                organization__userorganization__user=self.request.user
            )
        )

        queryset = Response.objects.filter(
            survey=survey
        ).prefetch_related('answers__question', 'answers__selected_options')

        completed = self.request.query_params.get('completed')
        if completed is not None:
            queryset = queryset.filter(
                is_completed=completed.lower() == 'true'
            )

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(submitted_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(submitted_at__lte=end_date)
        
        return queryset.order_by('-submitted_at')
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def survey_analytics(request, survey_id):
    survey = get_object_or_404(
        Survey.objects.filter(
            survey_id=survey_id,
            organization__userorganization__user=request.user
        )
    )

    analytics, created = SurveyAnalytics.objects.get_or_create(survey=survey)
    if created or (timezone.now() - analytics.last_calculated).seconds > 300:
        analytics.recalculate()

    basic_analytics = SurveyAnalyticsSerializer(analytics).data

    question_analytics = []
    for question in survey.questions.all().order_by('order'):
        answers_count = ResponseAnswer.objects.filter(question=question).count()
        question_data = {
            'question_id' : str(question.question_id),
            'question_text' : question.question_text,
            'question_type' : question.question_type,
            'question_count': answers_count
        }

        if question.question_type in ['multiple_choice', 'dropdown', 'checkbox']:
            options_data = []
            for option in question.options.all().order_by('order'):
                count = ResponseAnswer.objects.filter(
                    question=question,
                    selected_options=option
                ).count()

                percentage = round((count / answers_count * 100), 2) if answers_count > 0 else 0
                options_data.append({
                    'option_text': option.option_text,
                    'count': count,
                    'percentage': percentage
                })
            question_data['options_distribution'] = options_data
        
        elif question.question_type == 'rating':
            ratings = ResponseAnswer.objects.filter(
                question=question,
                answer_number__isnull=False
            )

            if ratings.exists():
                rating_values = [float(r.answer_number) for r in ratings]
                question_data['average_rating'] = round(sum(rating_values) / len(rating_values), 2)
                rating_dist = {}
                for rating in rating_values:
                    rating_int = int(rating)
                    rating_dist[rating_int] = rating_dist.get(rating_int, 0) + 1
                
                question_data['rating_distribution'] = rating_dist
        
        elif question.question_type in ['text', 'textarea']:
            text_responses = ResponseAnswer.objects.filter(
                question=question,
                answer_text__isnull=False
            ).exclude(answer_text='').values_list('answer_text', flat=True)[:5]

            question_data['sample_responses'] = list(text_responses)
        
        question_analytics.append(question_data)
    
    return APIResponse({
        'success': True,
        'data': {
            'survey_analytics': basic_analytics,
            'question_analytics': question_analytics,
            'last_updated': analytics.last_calculated
        }
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_survey_responses(request, survey_id):
    survey = get_object_or_404(
        Survey.objects.filter(
            survey_id=survey_id,
            organization__userorganization__user=request.user
        )
    )

    export_format = request.query_params.get('format', 'json').lower()
    responses = Response.objects.filter(
        survey=survey,
        is_completed=True
    ).prefetch_related('answers__question', 'answers__selected_options').order_by('-submitted_at')

    if export_format == 'csv':
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        filename = f"{survey.title.replace(' ', '_')}_responses_{timezone.now().strftime('%Y%m%d')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)
        headers = ['Response ID', 'Email', 'Name', 'Submitted At', 'Completion Time (seconds)']
        questions = survey.questions.all().order_by('order')

        for question in questions:
            headers.append(f"Q{question.order}: {question.question_text}")
        
        writer.writerow(headers)

        for resp in responses:
            row = [
                str(resp.response_id),
                resp.respondent_email or '',
                resp.respondent_name or '',
                resp.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if resp.submitted_at else '',
                resp.completion_time_seconds or ''
            ]

            for question in questions:
                try:
                    answer = resp.answers.get(question=question)
                    row.append(answer.display_value)
                except ResponseAnswer.DoesNotExist:
                    row.append('')
        return response
    else:
        serializer = ResponseSerializer(responses, many=True)
        return APIResponse({
            'success': True,
            'data': {
                'survey_title': survey.title,
                'export_date': timezone.now().isoformat(),
                'total_responses': responses.count(),
                'responses': serializer.data
            }
        }, status=status.HTTP_200_OK)
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def schedule_survey(request, survey_id):
    survey = get_object_or_404(
        Survey.objects.filter(
            survey_id = survey_id,
            organization__userorganization__user = request.user
        )
    )

    permission = SurveyPermission()
    if not permission.has_object_permission(request, None, survey):
        return APIResponse({
            'success': False,
            'message': 'Tidak memiliki izin untuk menjadwalkan survey ini'
        }, status=status.HTTP_403_FORBIDDEN)
    
    published_at = request.data.get('publish_at')
    closes_at = request.data.get('closes_at')
    if published_at:
        published_dt = timezone.datetime.fromisoformat(published_at.replace('Z', '+00:00'))
        if published_dt <= timezone.now():
            return APIResponse({
                'success': False,
                'message': 'Waktu publikasi harus di masa depan'
            }, status = status.HTTP_400_BAD_REQUEST)
        survey.published_at = published_dt
        survey.status = 'draft'
    if closes_at:
        closes_dt = timezone.datetime.fromisoformat(closes_at.replace('Z', '+00:00'))
        if closes_dt <= timezone.now():
            return APIResponse({
                'success': False,
                'message': 'Waktu penutupan harus di masa depan'
            }, status = status.HTTP_400_BAD_REQUEST)
        if published_at and closes_dt <= published_dt:
            return APIResponse({
                'success': False,
                'message': 'Waktu penutupan harus setelah waktu publikasi'
            }, status= status.HTTP_400_BAD_REQUEST)
        survey.closes_at = closes_dt
    survey.save()

    return APIResponse({
        'success': True,
        'message': 'Survey berhasil dijadwalkan',
        'data': {
            'survey_id': str(survey.survey_id),
            'status': survey.status,
            'published_at': survey.published_at.isoformat() if survey.published_at else None,
            'closes_at': survey.closes_at.isoformat() if survey.closes_at else None
        }
    }, status = status.HTTP_200_OK)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cancel_schedule(request, survey_id):
    survey = get_object_or_404(
        Survey.objects.filter(
            survey_id = survey_id,
            organization__userorganization__user = request.user
        )
    )

    permission = SurveyPermission()
    if not permission.has_object_permission(request, None, survey):
        return APIResponse({
            'success': False,
            'message': 'Tidak memiliki izin'
        }, status = status.HTTP_403_FORBIDDEN)
    
    action = request.query_params.get('action')
    if action == 'publish':
        survey.published_at = None
    elif action == 'close':
        survey.closes_at = None
    else:
        return APIResponse({
            'success': False,
            'message': 'Aksi harus di "publish" atau "close"'
        }, status = status.HTTP_400_BAD_REQUEST)
    survey.save()
    return APIResponse({
        'success': True,
        'message': f'Jadwal {action} dibatalkan'
    }, status = status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_overview(request):
    org_id = request.query_params.get('organization')
    if org_id:
        try:
            user_org = UserOrganization.objects.get(
                user = request.user,
                organization__org_id = org_id
            )
            organization = user_org.organization
        except UserOrganization.DoesNotExist:
            return APIResponse({
                'success': False,
                'message': 'Tidak memiliki akses ke organisasi ini'
            }, status = status.HTTP_403_FORBIDDEN)
    else:
        user_org = UserOrganization.objects.filter(
            user = request.user,
            role = 'admin'
        ).first()

        if not user_org:
            return APIResponse({
                'success': False,
                'message': 'User harus menjadi admin minimal satu organisasi'
            }, statis=status.HTTP_403_FORBIDDEN)
        
        organization = user_org.organization
        total_surveys = Survey.objects.filter(organization = organization).count()
        active_surveys = Survey.objects.filter(
            organization = organization,
            status = 'active'
        ).count()
        draft_surveys = Survey.objects.filter(
            organization = organization,
            status = 'draft'
        ).count()
        closed_surveys = Survey.objects.filter(
            organization = organization,
            status = 'closed'
        ).count()
        thirty_days_ago = timezone.now() - timedelta(days = 30)
        total_responses = Response.objects.filter(
            survey__organization = organization,
            submitted_at__gte = thirty_days_ago,
            is_completed = True
        ).count()
        avg_completion = Response.objects.filter(
            survey__organization = organization,
            is_complted = True,
            completion_time_seconds__isnull = False
        ).aggregate(
            avg_time = Avg('completion_time_seconds')
        )['avg_time']
        avg_completuon_formattted = None
        if avg_completion:
            minutes = int(avg_completion) // 60
            seconds = int(avg_completion) % 60
            avg_completion_formatted = f"{minutes}m {seconds}s"
        
        response_trend = []
        for i in range(6, -1, -1):
            date = timezone.now() - timedelta(days = i)
            count = Response.objects.filter(
                survey__organization = organization,
                submitted_at__date = date.date(),
                is_completed = True
            ).count()
            response_trend.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count
            })
        
        top_surveys = Survey.objects.filter(
            organization = organization,
            status__in = ['active', 'closed']
        ).annotate(
            response_count = Count('responses', filter = Q(responses__is_completed = True))
        ).order_by('-response_count')[:5]

        top_surveys_data = []
        for survey in top_surveys:
            completion_rate = 0
            total = survey.responses.count()
            completed = survey.responses.filter(is_completed = True).count()
            if total > 0:
                completion_rate = round((completed / total) * 100, 2)
            top_surveys_data.append({
                'survey_id': str(survey.survey_id),
                'title': survey.title,
                'response_count': survey.response_count,
                'completion_rate': completion_rate,
                'status': survey.status
            })
        
        recent_responses = Response.objects.filter(
            survey__organization = organization,
            is_completed = True
        ).select_related('survey').order_by('-submitted_at')[:10]
        recent_responses_data = []
        for resp in recent_responses:
            recent_responses_data.append({
                'response_id': str(resp.response_id),
                'survey_title': resp.survey.title,
                'respondent_email': resp.respondent_email or 'Amonymous',
                'submitted_at': resp.submitted_at.isoformat(),
                'completion_time': f"{resp.completion_time_seconds}s" if resp.completion_time_seconds else None
            })
        
        status_distribution = {
            'draft': draft_surveys,
            'active': active_surveys,
            'closed': closed_surveys
        }

        return APIResponse({
            'success': True,
            'data': {
                'summary': {
                    'total_surveys': total_surveys,
                    'active_surveys': active_surveys,
                    'draft_surveys': draft_surveys,
                    'closed_surveys': closed_surveys,
                    'total_responses_lat_30d': total_responses,
                    'avg_completion_time': avg_completion_formatted
                },
                'response_trend': response_trend,
                'top_surveys': top_surveys_data,
                'recent_responses': recent_responses_data,
                'statis_distribution': status_distribution,
                'last_updated': timezone.now().isoformat()
            }
        }, status = status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def survey_response_rate(request, survey_id):
    survey = get_object_or_404(
        Survey.objects.filter(
            survey_id = survey_id,
            organization__userorganization__user = request.user
        )
    )

    total_responses = survey.responses.count()
    completed_responses = survey.responses.filter(is_completed = True).count()
    completion_rate = 0
    if total_responses > 0:
        completion_rate = round((completed_responses / total_responses) * 100, 2)
    
    thirty_days_ago = timezone.now() - timedelta(days = 30)
    responses_by_date = survey.responses.filter(
        submitted_at__gte = thirty_days_ago
    ).annotate(
        date = TruncDate('submitted_at')
    ).values('date').annotate(
        count = Count('response_id')
    ).order_by('date')
    response_timeline = [
        {
            'date': item['date'].isoformat(),
            'count': item['count']
        }
        for item in responses_by_date
    ]

    completion_times = survey.responses.filter(
        is_completed = True,
        completion_time_seconds__isnull = False,
        submitted_at__gte = thirty_days_ago
    ).annotate(
        date = TruncDate('submitted_at')
    ).values('date').annotate(
        avg_time = Avg('completion_time_seconds')
    ).order_by('date')
    completion_timeline = [
        {
            'date': item['date'].isoformat(),
            'avg_time_seconds': round(item['avg_time'], 2)
        }
        for item in completion_times
    ]

    return APIResponse({
        'success': True,
        'data': {
            'survey_id': str(survey.survey_id),
            'title': survey.title,
            'total_responses': total_responses,
            'completed_responses': completed_responses,
            'completion_rate': completion_rate,
            'response_timeline': response_timeline,
            'completion_timeline': completion_timeline
        }
    }, status = status.HTTP_200_OK)