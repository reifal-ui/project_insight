from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from users.models import Organization, User
from surveys.models import Survey
import uuid, secrets
from django.conf import settings

# Create your models here.

class ContactList(models.Model):
    list_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='contact_lists')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_contact_lists')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contact_lists'
        verbose_name = 'Contact List'
        verbose_name_plural = 'Contact Lists'
        ordering = ['-created_at']
        unique_together = ('organization', 'name')

    def __str__(self):
        return f"{self.name} ({self.organization.name})"
    
    @property
    def contact_count(self):
        return self.contacts.count()
    
    @property
    def active_contact_count(self):
        return self.contacts.filter(is_active=True).count()
    
class Contact(models.Model):
    STATUS_CHOICES = [
        ('subscribed', 'Subscribed'),
        ('unsubscribed', 'Unsubscribed'),
        ('bounced', 'Bounced'),
        ('complained', 'Complained'),
    ]
    contact_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    first_name = models.CharField(max_length=150, blank=True, null=True)
    last_name = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    company = models.CharField(max_length=255, blank=True, null=True)
    job_title = models.CharField(max_length=255, blank=True, null=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='contacts')
    contact_lists = models.ManyToManyField(ContactList, related_name='contacts', blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='subscribed')
    custom_fields = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    source = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    last_contacted = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'contacts'
        verbose_name = 'Contact'
        verbose_name_plural = 'Contacts'
        ordering = ['-created_at']
        unique_together = ('organization', 'email')
    
    def __str__(self):
        name = self.get_full_name()
        return f"{name} ({self.email})" if name else self.email
    
    def get_full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        return ""
    
    @property
    def display_name(self):
        return self.get_full_name() or self.email
    
    def can_receive_surveys(self):
        return self.is_active and self.status == 'subscribed'
    
class ContactImport(models.Model):
    IMPORT_STATUS_CHOICES = [
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('partial', 'Partially Completed'),
    ]
    import_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='contact_imports')
    contact_list = models.ForeignKey(ContactList, on_delete=models.CASCADE, related_name='imports')
    imported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    filename = models.CharField(max_length=255)
    total_rows = models.IntegerField(default=0)
    processed_rows = models.IntegerField(default=0)
    successful_imports = models.IntegerField(default=0)
    failed_imports = models.IntegerField(default=0)
    duplicate_imports = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=IMPORT_STATUS_CHOICES, default='processing')
    error_log = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'contact_imports'
        verbose_name = 'Contact Import'
        verbose_name_plural = 'Contact Imports'
        ordering = ['-started_at']

    def __str__(self):
        return f"Import {self.filename} to {self.contact_list.name}"
    
    @property
    def success_rate(self):
        if self.processed_rows == 0:
            return 0
        return round((self.successful_imports / self.processed_rows) * 100, 2)
    
class SurveyInvitation(models.Model):
    INVITATION_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('responded', 'Responded'),
        ('bounced', 'Bounced'),
        ('failed', 'Failed'),
    ]
    
    invitation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='invitations')
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='survey_invitations')
    subject_line = models.CharField(max_length=255)
    message_body = models.TextField()
    sender_email = models.EmailField(blank=True, null=True)
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=INVITATION_STATUS_CHOICES, default='pending')
    sent_by = models.ForeignKey(User, on_delete=models.CASCADE)
    tracking_token = models.CharField(max_length=64, unique=True, blank=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    opened_at = models.DateTimeField(blank=True, null=True)
    clicked_at = models.DateTimeField(blank=True, null=True)
    responded_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'survey_invitations'
        verbose_name = 'Survey Invitation'
        verbose_name_plural = 'Survey Invitations'
        ordering = ['-created_at']
        unique_together = ('survey', 'contact')

    def save(self, *args, **kwargs):
        if not self.tracking_token:
            self.tracking_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Invitation to {self.contact.email} for '{self.survey.title}'"
    
    @property
    def survey_url(self):
        base_url = getattr(settings, 'SITE_URL', 'http://localhost:8000')
        return f"{base_url}/surveys/take/{self.survey.share_token}?invitation={self.tracking_token}"

class EmailTemplate(models.Model):
    TEMPLATE_TYPE_CHOICES = [
        ('invitation', 'Survey Invitation'),
        ('reminder', 'Survey Reminder'),
        ('thank_you', 'Thank You'),
        ('custom', 'Custom'),
    ]

    template_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='email_templates')
    name = models.CharField(max_length=255)
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPE_CHOICES)
    subject_line = models.CharField(max_length=255)
    message_body = models.TextField()
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'email_templates'
        verbose_name = 'Email Template'
        verbose_name_plural = 'Email Templates'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.template_type})"
    
    def render_for_contact(self, contact, survey, invitation=None):
        context = {
            'first_name': contact.first_name or '',
            'last_name': contact.last_name or '',
            'full_name': contact.get_full_name() or contact.email,
            'email': contact.email,
            'survey_title': survey.title,
            'survey_description': survey.description or '',
            'organization_name': survey.organization.name,
        }

        if invitation:
            context['survey_url'] = invitation.survey_url
        else:
            base_url = getattr(settings, 'SITE_URL', 'http://localhost:8000')
            context['survey_url'] = f"{base_url}/surveys/take/{survey.share_token}"

        rendered_subject = self.subject_line
        rendered_body = self.message_body

        for key, value in context.items():
            placeholder = '{' + key + '}'
            rendered_subject = rendered_subject.replace(placeholder, str(value))
            rendered_body = rendered_body.replace(placeholder, str(value))

        return rendered_subject, rendered_body
    
def create_default_email_templates(organization, created_by):
    invitation_template = EmailTemplate.objects.create(
        organization=organization,
        name="Default Survey Invitation",
        template_type="invitation",
        subject_line="You're invited to participate: {survey.title}",
        message_body="""
Hello {first_name},

You've been invited to participate in our survey: {survey_title}

{survey_description}

Your feedback is valuable to us and will help us improve our services. The survey should take just a few minutes to complete.

Click here to start: {survey_url}

Thank you for your time!

Best regards,
{organization_name} Team
        """.strip(),
        is_default=True,
        created_by=created_by
    )

    reminder_template = EmailTemplate.objects.create(
        organization=organization,
        name="Default Survey Reminder",
        template_type="reminder",
        subject_line="Reminder: {survey_title} - Your input matters",
        message_body="""
Hello {first_name},

This is a friendly reminder about our survey: {survey_title}

We haven't received your response yet, and we'd love to hear from you. Your feedback is important to us.

Click here to participate: {survey_url}

Thank you!

Best regards,
{organization_name} Team
        """.strip(),
        is_default=True,
        created_by=created_by
    )

    return [invitation_template, reminder_template]

class EmailCampaign(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('paused', 'Paused'),
        ('failed', 'Failed'),
    ]

    campaign_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    survey = models.ForeignKey('surveys.Survey', on_delete=models.CASCADE, related_name='campaigns')
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE)
    contact_lists = models.ManyToManyField('ContactList', blank=True)
    email_template = models.ForeignKey('EmailTemplate', on_delete=models.SET_NULL, null=True)
    subject_line = models.CharField(max_length=255)
    message_body = models.TextField()
    sender_name = models.CharField(max_length=255)
    sender_email = models.EmailField()
    scheduled_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[('draft', 'Draft'), ('scheduled', 'Scheduled'), ('sent', 'Sent'), ('failed', 'Failed')],
        default='draft'
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    total_recipients = models.IntegerField(default=0)
    emails_sent = models.IntegerField(default=0)
    emails_delivered = models.IntegerField(default=0)
    emails_opened = models.IntegerField(default=0)
    emails_clicked = models.IntegerField(default=0)
    emails_failed = models.IntegerField(default=0)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'email_campaigns'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.status}"
    
    @property
    def open_rate(self):
        if self.emails_delivered == 0:
            return 0
        return round((self.emails_opened / self.emails_delivered) * 100, 2)
    
    @property
    def click_rate(self):
        if self.emails_delivered == 0:
            return 0
        return round((self.emails_clicked / self.emails_delivered) * 100, 2)

class InvitationTracking(models.Model):
    tracking_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invitation = models.OneToOneField('SurveyInvitation', on_delete=models.CASCADE, related_name='tracking')
    campaign = models.ForeignKey(EmailCampaign, on_delete=models.CASCADE, null=True, blank=True)
    opened_count = models.IntegerField(default=0)
    clicked_count = models.IntegerField(default=0)
    first_opened_at = models.DateTimeField(null=True, blank=True)
    last_opened_at = models.DateTimeField(null=True, blank=True)
    first_clicked_at = models.DateTimeField(null=True, blank=True)
    last_clicked_at = models.DateTimeField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'invitation_tracking'
    
    def record_open(self, user_agent=None, ip_address=None):
        now = timezone.now()
        if not self.first_opened_at:
            self.first_opened_at = now
        self.last_opened_at = now
        self.opened_count += 1
        if user_agent:
            self.user_agent = user_agent
        if ip_address:
            self.ip_address = ip_address
        self.save()

    def record_click(self):
        now = timezone.now()
        if not self.first_clicked_at:
            self.first_clicked_at = now
        self.last_clicked_at = now
        self.clicked_count += 1
        self.save()