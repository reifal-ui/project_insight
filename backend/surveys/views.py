from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response as APIResponse
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Avg
from django.db import transaction
from django.http import HttpResponse
import csv

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
        user_orgs = UserOrganization.objects.filter(user=user).values_list('organization_id', flat=True)
        queryset = Survey.objects.filter(organization_id__in=user_orgs)

        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(title__icontains=search)
        
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

        serializer.save(
            created_by=self.request.user,
            organization=organization
        )

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
    
@api_view
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
            organization__userorganization__user=request.useer
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
                resp.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if resp.submitetd_at else '',
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