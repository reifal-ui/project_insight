from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import secrets
import hashlib

class User(AbstractUser):
    user_id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    created_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=100, blank=True, null=True)
    password_reset_token = models.CharField(max_length=100, blank=True, null=True)
    password_reset_expires = models.DateTimeField(blank=True, null=True)
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    @property
    def id(self):
        return self.user_id
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
    
    def generate_verification_token(self):
        self.email_verification_token = secrets.token_urlsafe(32)
        self.save(update_fields=['email_verification_token'])
        return self.email_verification_token
    
    def generate_password_reset_token(self):
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_expires = timezone.now() + timezone.timedelta(hours=1)
        self.save(update_fields=['password_reset_token', 'password_reset_expires'])
        return self.password_reset_token
    
    def verify_email(self):
        self.email_verified = True
        self.email_verification_token = None
        self.save(update_fields=['email_verified', 'email_verification_token'])

class Organization(models.Model):
    SUBSCRIPTION_CHOICES = [
        ('starter', 'Starter'),
        ('pro', 'Pro'),
        ('enterprise', 'Enterprise'),
    ]
    
    org_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    owner_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='owned_organizations'
    )
    subscription_plan = models.CharField(
        max_length=50,
        choices=SUBSCRIPTION_CHOICES,
        default='starter'
    )
    created_at = models.DateTimeField(default=timezone.now)
    subscription_status = models.CharField(
        max_length=20,
        choices=[
            ('active', 'Active'),
            ('trialing', 'Trial'),
            ('expired', 'Expired'),
            ('canceled', 'Canceled')
        ],
        default='trialing'
    )
    trial_ends_at = models.DateTimeField(blank=True, null=True)
    subscription_started_at = models.DateTimeField(blank=True, null=True)
    subscription_expires_at = models.DateTimeField(blank=True, null=True)
    surveys_created_this_month = models.IntegerField(default=0)
    last_usage_reset = models.DateField(blank=True, null=True)
    
    class Meta:
        db_table = 'organizations'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'
    
    def __str__(self):
        return self.name
    
    def get_survey_limit(self):
        limits = {
            'starter': 3,
            'pro': 50,
            'enterprise': None
        }
        return limits.get(self.subscription_plan)
    
    def get_response_limit(self):
        limits = {
            'starter': 100,
            'pro': 5000,
            'enterprise': 50000
        }
        return limits.get(self.subscription_plan)
    
    def get_team_member_limit(self):
        limits = {
            'starter': 1,
            'pro': 10,
            'enterprise': 50
        }
        return limits.get(self.subscription_plan)
    
    def can_create_survey(self):
        """Check if org can create more surveys this month"""
        survey_limit = self.get_survey_limit()
        if survey_limit is None:
            return True
        today = timezone.now().date()
        if not self.last_usage_reset or self.last_usage_reset.month != today.month:
            self.surveys_created_this_month = 0
            self.last_usage_reset = today
            self.save(update_fields=['surveys_created_this_month', 'last_usage_reset'])
        
        return self.surveys_created_this_month < survey_limit
    
    def has_feature(self, feature_name):
        features = {
            'starter': [
                'basic_surveys',
                'csv_export',
            ],
            'pro': [
                'basic_surveys',
                'csv_export',
                'json_export',
                'custom_branding',
                'conditional_logic',
                'api_access',
                'webhooks',
                'email_support'
            ],
            'enterprise': [
                'basic_surveys',
                'csv_export',
                'json_export',
                'pdf_export',
                'custom_branding',
                'white_labeling',
                'conditional_logic',
                'api_access',
                'webhooks',
                'priority_support',
                'custom_integrations'
            ]
        }
        
        plan_features = features.get(self.subscription_plan, [])
        return feature_name in plan_features
    
    def increment_survey_count(self):
        self.surveys_created_this_month += 1
        self.save(update_fields=['surveys_created_this_month'])

class UserOrganization(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('member', 'Member'),
        ('viewer', 'Viewer'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'user_organizations'
        unique_together = ('user', 'organization')
        verbose_name = 'User Organization'
        verbose_name_plural = 'User Organizations'
    
    def __str__(self):
        return f"{self.user.email} - {self.organization.name} ({self.role})"

class OrganizationInvitation(models.Model):
    email = models.EmailField()
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=UserOrganization.ROLE_CHOICES, default='member')
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    is_accepted = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'organization_invitations'
        unique_together = ('email', 'organization')
        verbose_name = 'Organization Invitation'
        verbose_name_plural = 'Organization Invitations'
    
    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=7)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    def __str__(self):
        return f"Invitation for {self.email} to {self.organization.name}"

class APIKey(models.Model):
    key_id = models.CharField(max_length=32, primary_key=True)
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='api_keys')
    name = models.CharField(max_length=255)
    key_hash = models.CharField(max_length=64, unique=True)
    key_prefix = models.CharField(max_length=8)
    can_read = models.BooleanField(default=True)
    can_write = models.BooleanField(default=True)
    can_delete = models.BooleanField(default=False)
    rate_limit = models.IntegerField(default=1000, help_text="Requests per hour")
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey('User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'api_keys'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"
    
    @staticmethod
    def generate_key():
        raw_key = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_prefix = raw_key[:8]
        key_id = secrets.token_hex(16)
        return raw_key, key_hash, key_prefix, key_id
    
    def verify_key(self, raw_key):
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        return key_hash == self.key_hash

class APIUsageLog(models.Model):
    log_id = models.BigAutoField(primary_key=True)
    api_key = models.ForeignKey(APIKey, on_delete=models.CASCADE, related_name='usage_logs')
    endpoint = models.CharField(max_length=255)
    method = models.CharField(max_length=10)
    status_code = models.IntegerField()
    response_time_ms = models.IntegerField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    
    class Meta:
        db_table = 'api_usage_logs'
        ordering = ['-timestamp']

class Webhook(models.Model):
    EVENT_CHOICES = [
        ('response.new', 'New Survey Response'),
        ('survey.published', 'Survey Published'),
        ('survey.closed', 'Survey Closed'),
        ('contact.created', 'Contact Created'),
    ]
    
    webhook_id = models.CharField(max_length=32, primary_key=True)
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, related_name='webhooks')
    url = models.URLField(max_length=500)
    events = models.JSONField(default=list)
    secret = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    failure_count = models.IntegerField(default=0)
    last_failure_at = models.DateTimeField(null=True, blank=True)
    last_failure_reason = models.TextField(blank=True)
    created_by = models.ForeignKey('User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'webhooks'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Webhook to {self.url}"
    
    def save(self, *args, **kwargs):
        if not self.webhook_id:
            self.webhook_id = secrets.token_hex(16)
        if not self.secret:
            self.secret = secrets.token_hex(32)
        super().save(*args, **kwargs)

class WebhookDelivery(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]
    
    delivery_id = models.BigAutoField(primary_key=True)
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name='deliveries')
    event_type = models.CharField(max_length=50)
    payload = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    status_code = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    retry_count = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'webhook_deliveries'
        ordering = ['-created_at']