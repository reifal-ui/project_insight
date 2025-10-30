from rest_framework import serializers
from django.utils import timezone
from .models import (
    Survey, Question, QuestionOption, Response, 
    ResponseAnswer, SurveyTheme, SurveyAnalytics
)

class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ['option_id', 'option_text', 'option_value', 'order']
        read_only_fields = ['option_id']

class QuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, required=False)

    class Meta:
        model = Question
        fields = [
            'question_id', 'question_text', 'question_type', 'is_required',
            'order', 'rating_min', 'rating_max', 'rating_min_label',
            'rating_max_label', 'placeholder_text', 'help_text', 'options'
        ]
        read_only_fields = ['question_id']

    def create(self, validated_data):
        options_data = validated_data.pop('options', [])
        question = Question.objects.create(**validated_data)

        for option_data in options_data:
            QuestionOption.objects.create(question = question, **option_data)
        
        return question
    
    def update(self, instance, validated_data):
        options_data = validated_data.pop('options', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if options_data:
            instance.options.all().delete()
            for option_data in options_data:
                QuestionOption.objects.create(question=instance, **option_data)
        
        return instance
    
class SurveyThemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyTheme
        fields = [
            'primary_color', 'secondary_color', 'background_color', 'text_color',
            'font_family', 'font_size', 'logo_url', 'company_name',
            'show_progress_bar', 'show_question_numbers'
        ]

class SurveyAnalyticsSerializer(serializers.ModelSerializer):
    completion_rate = serializers.SerializerMethodField()
    average_completion_time_formatted = serializers.SerializerMethodField()

    class Meta:
        model = SurveyAnalytics
        fields = [
            'total_responses', 'completed_responses', 'average_completion_time',
            'unique_visitors', 'bounce_rate', 'completion_rate',
            'average_completion_time_formatted', 'last_calculated'
        ]
    
    def get_completion_rate(self, obj):
        if obj.total_responses == 0:
            return 0
        return round((obj.completed_responses / obj.total_responses) * 100, 2)
    
    def get_average_completion_time_formatted(self, obj):
        if obj.average_completion_time == 0:
            return '0m 0s'
        
        minutes = obj.average_completion_time // 60
        seconds = obj.average_completion_time % 60
        return f"{minutes}m {seconds}s"
    
class SurveyListSerializer(serializers.ModelSerializer):
    response_count = serializers.ReadOnlyField()
    completion_rate = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = Survey
        fields = [
            'survey_id', 'title', 'status', 'is_public', 'response_count',
            'completion_rate', 'created_by_name', 'created_at', 'updated_at',
            'share_token'
        ]

class SurveyDetailSerializer(serializers.ModelSerializer):
    questions =  QuestionSerializer(many=True, required=False)
    theme = SurveyThemeSerializer(required=False)
    analytics = SurveyAnalyticsSerializer(read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = Survey
        fields = [
            'survey_id', 'title', 'description', 'status', 'is_public',
            'allow_anonymous', 'collect_email', 'published_at', 'closes_at',
            'share_token', 'created_at', 'updated_at', 'created_by_name',
            'organization_name', 'questions', 'theme', 'analytics'
        ]
        read_only_fields = ['survey_id', 'share_token', 'created_at', 'updated_at']

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        theme_data = validated_data.pop('theme', {})
        survey = Survey.objects.create(**validated_data)

        for question_data in questions_data:
            options_data = question_data.pop('options', [])
            question = Question.objects.create(survey=survey, **question_data)
            for option_data in options_data:
                QuestionOption.objects.create(question=question, **option_data)
        
        if theme_data:
            SurveyTheme.objects.create(survey=survey, **theme_data)
        SurveyAnalytics.objects.create(survey=survey)
        return survey
    
    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', None)
        theme_data = validated_data.pop('theme', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if questions_data is not None:
        # Hapus semua question lama beserta options
            instance.questions.all().delete()

            for question_data in questions_data:
                options_data = question_data.pop('options', [])
                question = Question.objects.create(survey=instance, **question_data)

            # Buat options baru
                for option in options_data:
                    QuestionOption.objects.create(question=question, **option)

        if theme_data is not None:
            theme, created = SurveyTheme.objects.get_or_create(survey=instance)
            for attr, value in theme_data.items():
                setattr(theme, attr, value)
            theme.save()

        return instance

class SurveyPublicSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    theme = SurveyThemeSerializer(read_only=True)

    class Meta:
        model = Survey
        fields = [
            'survey_id', 'title', 'description', 'allow_anonymous',
            'collect_email', 'questions', 'theme'
        ]

class ResponseAnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    selected_options = QuestionOptionSerializer(many=True, required=False)
    display_value = serializers.ReadOnlyField()

    class Meta:
        model = ResponseAnswer
        fields = [
            'answer_id', 'question', 'question_text', 'question_type',
            'answer_text', 'answer_number', 'answer_date', 'answer_boolean',
            'selected_options', 'display_value'
        ]
        read_only_fields = ['answer_id']

class ResponseSerializer(serializers.ModelSerializer):
    answers = ResponseAnswerSerializer(many=True, required=False)
    completion_time_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Response
        fields = [
            'response_id', 'respondent_email', 'respondent_name',
            'is_completed', 'submitted_at', 'started_at',
            'completion_time_seconds', 'completion_time_formatted', 'answers'
        ]
        read_only_fields = ['response_id', 'started_at']

    def get_completion_time_formatted(self, obj):
        if not obj.completion_time_seconds:
            return None
        minutes = obj.completion_time_seconds // 60
        seconds = obj.completion_time_seconds % 60
        return f"{minutes}m {seconds}s"

class ResponseSubmissionSerializer(serializers.Serializer):
    respondent_email = serializers.EmailField(required=False, allow_blank=True)
    respondent_name = serializers.CharField(required=False, allow_blank=True)
    answers = serializers.ListField(child=serializers.DictField())

    def validated_answers(self, value):
        for answer in value:
            if 'question' not in answer:
                raise serializers.ValidationError("Each answer must have a question_id")
            
            answer_fields = [
                'answer_text', 'answer_number', 'answer_date', 'answer_boolean', 'selected_option_ids'
            ]
            if not any(field in answer for field in answer_fields):
                raise serializers.ValidationError("Each answer must have at least one answer field")
        
        return value
    
    def create(self, validated_data):
        survey = self.context['survey']
        request = self.context['request']
        response = Response.objects.create(
            survey=survey,
            respondent_email=validated_data.get('respondent_email'),
            respondent_name=validated_data.get('respondent_name'),
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )

        for answer_data in validated_data['answers']:
            question_id = answer_data.pop('question_id')
            selected_option_ids = answer_data.pop('selected_option_ids', [])

            try:
                question = Question.objects.get(question_id=question_id, survey=survey)
            except Question.DoesNotExist:
                continue

            answer = ResponseAnswer.objects.create(
                response=response,
                question=question,
                **answer_data
            )

            if selected_option_ids:
                valid_options = QuestionOption.objects.filter(
                    option_id__in=selected_option_ids,
                    question=question
                )
                answer.selected_options.set(valid_options)
        
        response.is_completed = True
        response.submitted_at = timezone.now()
        response.calculate_completion_time()

        return response
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')

class SurveyDuplicateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    include_responses = serializers.BooleanField(default=False)

    def create(self, validated_data):
        original_survey = self.context['original_survey']
        user = self.context['user']
        organization = self.context['organization']
        new_survey = Survey.objects.create(
            title=validated_data['title'],
            description=original_survey.description,
            organization=organization,
            created_by=user,
            status='draft',
            is_public=original_survey.is_public,
            allow_anonymous=original_survey.allow_anonymous,
            collect_email=original_survey.collect_email
        )

        for question in original_survey.questions.all():
            new_question = Question.objects.create(
                survey=new_survey,
                question_text=question.question_text,
                question_type=question.question_type,
                is_required=question.is_required,
                order=question.order,
                rating_min=question.rating_min,
                rating_max=question.rating_max,
                rating_min_label=question.rating_min_label,
                rating_max_label=question.rating_max_label,
                placeholder_text=question.placeholder_text,
                help_text=question.help_text
            )

            for option in question.options.all():
                QuestionOption.objects.create(
                    question=new_question,
                    option_text=option.option_text,
                    option_value=option.option_value,
                    order=option.order
                )
        
        try:
            original_theme = original_survey.theme
            SurveyTheme.objects.create(
                survey=new_survey,
                primary_color=original_theme.primary_color,
                secondary_color=original_theme.secondary_color,
                background_color=original_theme.background_color,
                text_color=original_theme.text_color,
                font_family=original_theme.font_family,
                font_size=original_theme.font_size,
                logo_url=original_theme.logo_url,
                company_name=original_theme.company_name,
                show_progress_bar=original_theme.show_progress_bar,
                show_question_numbers=original_theme.show_question_numbers
            )
        except SurveyTheme.DoesNotExist:
            pass

        SurveyAnalytics.objects.create(survey=new_survey)

        return new_survey