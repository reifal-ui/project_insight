from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from users.models import Organization
import uuid
import secrets

# Create your models here.

User = get_user_model()

class Survey(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('closed', 'Closed'),
        ('archived', 'Archived'),
    ]

    survey_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='surveys')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_surveys')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_public = models.BooleanField(default=True)
    allow_anonymous = models.BooleanField(default=True)
    collect_email = models.BooleanField(default=False)
    published_at = models.DateTimeField(blank=True, null=True)
    closes_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    share_token = models.CharField(max_length=64, unique=True, blank=True)

    class Meta:
        db_table = 'surveys'
        verbose_name = 'Survey'
        verbose_name_plural = 'Surveys'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.share_token:
            self.share_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.title} ({self.organization.name})"
    
    @property
    def is_active(self):
        now = timezone.now()
        if self.status != 'active':
            return False
        if self.published_at and self.published_at > now:
            return False
        if self.closes_at and self.closes_at < now:
            return False
        return True
    
    @property
    def response_count(self):
        return self.responses.count()
    
    @property
    def completion_rate(self):
        total_responses = self.responses.count()
        completed_responses = self.responses.filter(is_completed=True).count()
        if total_responses == 0:
            return 0
        return round((completed_responses / total_responses) * 100, 2)
    
class Question(models.Model):
    QUESTION_TYPES = [
        ('text', 'Text Input'),
        ('textarea', 'Long Text'),
        ('multiple_choice', 'Multiple Choice'),
        ('checkbox', 'Checkboxes'),
        ('dropdown', 'Dropdown'),
        ('rating', 'Rating Scale'),
        ('yes_no', 'Yes/No'),
        ('email', 'Email'),
        ('number', 'Number'),
        ('date', 'Date'),
    ]

    question_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    is_required = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    rating_min = models.IntegerField(default=1, blank=True, null=True)
    rating_max = models.IntegerField(default=5, blank=True, null=True)
    rating_min_label = models.CharField(max_length=50, blank=True, null=True)
    rating_max_label = models.CharField(max_length=50, blank=True, null=True)
    placeholder_text =  models.CharField(max_length=255, blank=True, null=True)
    help_text = models.TextField(blank=True, null=True)
    show_if_question = models.ForeignKey('self', on_delete=models.CASCADE, blank=True, null=True)
    show_if_answer = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'questions'
        verbose_name = 'Question'
        verbose_name_plural = 'Questions'
        ordering = ['survey', 'order']

    def __str__(self):
        return f"Q{self.order}: {self.question_text[:50]}..."

class QuestionOption(models.Model):
    option_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    option_text = models.CharField(max_length=255)
    option_value = models.CharField(max_length=255, blank=True, null=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'question_options'
        verbose_name = 'Question Option'
        verbose_name_plural = 'Question Options'
        ordering = ['question', 'order']
    
    def __str__(self):
        return f"{self.question.question_text[:30]}... - {self.option_text}"

class Response(models.Model):
    response_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='responses')
    respondent_email = models.EmailField(blank=True, null=True)
    respondent_name = models.CharField(max_length=255, blank=True, null=True)
    is_completed = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(blank=True, null=True)
    started_at = models.DateTimeField(default=timezone.now)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    completion_time_seconds = models.IntegerField(blank=True, null=True)

    class Meta:
        db_table = 'responses'
        verbose_name = 'Response'
        verbose_name_plural = 'Responses'
        ordering = ['-started_at']
    
    def __str__(self):
        email = self.respondent_email or 'Anonymous'
        return f"Response to '{self.survey.title}' by {email}"

    def calculate_completion_time(self):
        if self.submitted_at and self.started_at:
            delta = self.submitted_at - self.started_at
            self.completion_time_seconds = int(delta.total_seconds())
            self.save(update_fields=['completion_time_seconds'])

class ResponseAnswer(models.Model):
    answer_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response = models.ForeignKey(Response, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer_text = models.TextField(blank=True, null=True)
    answer_number = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    answer_date = models.DateField(blank=True, null=True)
    answer_boolean = models.BooleanField(blank=True, null=True)
    selected_options = models.ManyToManyField(QuestionOption, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'response_answers'
        verbose_name = 'Response Answer'
        verbose_name_plural = 'Response Answers'
        unique_together = ['response', 'question']
    
    def __str__(self):
        return f"Answer to '{self.question.question_text[:30]}..."

    @property
    def display_value(self):
        if self.answer_text:
            return self.answer_text
        elif self.answer_number is not None:
            return str(self.answer_number)
        elif self.answer_date:
            return self.answer_date.strftime('%Y-%m-%d')
        elif self.answer_boolean is not None:
            return 'Yes' if self.answer_boolean else 'No'
        elif self.selected_options.exists():
            return ', '.join([opt.option_text for opt in self.selected_options.all()])
        return ''
    
class SurveyTheme(models.Model):
    theme_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.OneToOneField(Survey, on_delete=models.CASCADE, related_name='theme')
    primary_color = models.CharField(max_length=7, default='#007bff')
    secondary_color = models.CharField(max_length=7, default='#6c757d')
    background_color = models.CharField(max_length=7, default='#ffffff')
    text_color = models.CharField(max_length=7, default='#333333')
    font_family = models.CharField(max_length=100, default='Arial, sans-serif')
    font_size = models.CharField(max_length=20, default='16px')
    logo_url = models.URLField(blank=True, null=True)
    company_name = models.CharField(max_length=255, blank=True, null=True)
    show_progress_bar = models.BooleanField(default=True)
    show_question_numbers = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'survey_themes'
        verbose_name = 'Survey Theme'
        verbose_name_plural = 'Survey Themes'
    
    def __str__(self):
        return f"Theme for '{self.survey.title}'"

class SurveyAnalytics(models.Model):
    survey = models.OneToOneField(Survey, on_delete=models.CASCADE, related_name='analytics')
    total_responses = models.IntegerField(default=0)
    completed_responses = models.IntegerField(default=0)
    average_completion_time = models.IntegerField(default=0)
    unique_visitors = models.IntegerField(default=0)
    bounce_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    last_calculated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'survey_analytics'
        verbose_name = 'Survey Analytics'
        verbose_name_plural = 'Survey Analytics'
    
    def __str__(self):
        return f"Analytics for '{self.survey.title}'"
    
    def recalculate(self):
        responses = self.survey.responses.all()
        completed = responses.filter(is_completed=True)
        self.total_responses = responses.count()
        self.completed_responses = completed.count()
        completion_times = completed.exclude(completion_time_seconds__isnull=True)
        if completion_times.exists():
            avg_time = completion_times.aggregate(
                avg=models.Avg('completion_time_seconds')
            )['avg']
            self.average_completion_time = int(avg_time) if avg_time else 0
        
        self.save()