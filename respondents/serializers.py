from rest_framework import serializers
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import ContactList, Contact, ContactImport, SurveyInvitation, EmailTemplate, EmailCampaign, InvitationTracking
import csv
import io
from surveys.models import Survey

class ContactListSerializer(serializers.ModelSerializer):
    contact_count = serializers.ReadOnlyField()
    active_contact_count = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = ContactList
        fields = [
            'list_id', 'name', 'description', 'is_active', 'contact_count',
            'active_contact_count', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['list_id', 'created_at', 'updated_at']

class ContactSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    contact_lists = ContactListSerializer(many=True, read_only=True)
    contact_list_ids = serializers.ListField(
        child = serializers.UUIDField(),
        write_only = True,
        required = False
    )

    class Meta:
        model = Contact
        fields = [
            'contact_id', 'email', 'first_name', 'last_name', 'phone',
            'company', 'job_title', 'status', 'is_active', 'custom_fields',
            'source', 'display_name', 'contact_lists', 'contact_list_ids',
            'created_at', 'updated_at', 'last_contacted'
        ]
        read_only_fields = ['contact_id', 'created_at', 'updated_at']

    def validate_email(self, value):
        organization = self.context.get('organization')
        contact_id = self.instance.contact_id if self.instance else None
        existing = Contact.objects.filter(
            organization=organization,
            email=value
        )

        if contact_id:
            existing = existing.exclude(contact_id=contact_id)
        
        if existing.exists():
            return serializers.ValidationError("Email sudah ada dalam organisasi ini")
        
        return value.lower().strip()
    
    def create(self, validated_data):
        contact_list_ids = validated_data.pop('contact_list_ids', [])
        organization = self.context.get('organization')
        created_by = self.context.get('created_by')
        contact = Contact.objects.create(
            organization=organization,
            created_by=created_by,
            **validated_data
        )

        if contact_list_ids:
            contact_lists = ContactList.objects.filter(
                list_id__in=contact_list_ids,
                organization=organization
            )
            contact.contact_lists.set(contact_lists)

        return contact
    
    def update(self, instance, validated_data):
        contact_list_ids = validated_data.pop('contact_list_id', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if contact_list_ids is not None:
            contact_lists = ContactList.objects.filter(
                list_id__in=contact_list_ids,
                organization=instance.organization
            )
            instance.contact_lists.set(contact_lists)
        
        return instance

class ContactImportSerializer(serializers.Serializer):
    contact_list_id = serializers.UUIDField()
    csv_file = serializers.FileField()
    update_existing = serializers.BooleanField(default=False)

    def validate_csv_file(self, value):
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("File harus berformat CSV")
        
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("File terlalu besar (maksimal 5MB)")
        
        return value
    
    def validated_contact_list_id(self, value):
        organization = self.context.get('organization')

        try:
            contact_list = ContactList.objects.get(
                list_id=value,
                organization=organization
            )
            return contact_list
        except ContactList.DoesNotExist:
            raise serializers.ValidationError("Contact list tidak ditemukan")
        
    def create(self, validated_data):
        contact_list = validated_data['contact_list_id']
        csv_file = validated_data['csv_file']
        update_existing = validated_data['update_existing']
        organization = self.context.get('organization')
        imported_by = self.context.get('imported_by')
        import_record = ContactImport.objects.create(
            organization=organization,
            contact_list=contact_list,
            imported_by=imported_by,
            filename=csv_file.name,
            status='processing'
        )

        try:
            csv_content = csv_file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(csv_content))
            required_columns = ['email']
            if not all(col in csv_reader.fieldnames for col in required_columns):
                raise ValidationError("CSV harus memiliki kolom 'email'")
            
            total_rows = 0
            successful_imports = 0
            failed_imports = 0
            duplicate_emails = 0
            errors = []

            for row_num, row in enumerate(csv_reader, start=1):
                total_rows += 1
                try:
                    email = row.get('email', '').strip().lower()
                    if not email:
                        failed_imports += 1
                        errors.append(f"Baris {row_num}: Email kosong")
                        continue

                    existing_contact = Contact.objects.filter(
                        organization=organization,
                        email=email
                    ).first()
                    
                    contact_data = {
                        'email': email,
                        'first_name': row.get('first_name', '').strip(),
                        'last_name': row.get('last_name', '').strip(),
                        'phone': row.get('phone', '').strip(),
                        'company': row.get('company', '').strip(),
                        'job_title': row.get('job_title', '').strip(),
                        'source': 'import'
                    }
                    custom_fields = {}
                    for key, value in row.items():
                        if key not in ['email', 'first_name', 'last_name', 'phone', 'company', 'job_title']:
                            if value.strip():
                                custom_fields[key] = value.strip()
                    if custom_fields:
                        contact_data['custom_fields'] = custom_fields
                    if existing_contact:
                        if update_existing:
                            for key, value in contact_data.items():
                                if key != 'source':
                                    setattr(existing_contact, key, value)
                            existing_contact.save()

                            if not existing_contact.contact_lists.fillter(list_id=contact_list.list_id).exists():
                                existing_contact.contact_lists.add(contact_list)
                            
                            successful_imports += 1
                        else:
                            duplicate_emails += 1
                            errors.append(f"Baris {row_num}: Email {email} sudah ada")
                    else:
                        contact = Contact.objects.create(
                            organization=organization,
                            created_by=imported_by,
                            **contact_data
                        )
                        contact.contact_lists.add(contact_list)
                        successful_imports += 1
                
                except Exception as e:
                    failed_imports += 1
                    errors.append(f"Baris {row_num}: {str(e)}")

            import_record.total_rows = total_rows
            import_record.processed_rows = total_rows
            import_record.successful_imports = successful_imports
            import_record.failed_imports = failed_imports
            import_record.duplicate_emails = duplicate_emails
            import_record.error_log = errors
            import_record.status = 'completed' if failed_imports == 0 else 'partial'
            import_record.completed_at = timezone.now()
            import_record.save()
            
            return import_record
            
        except Exception as e:
            import_record.status = 'failed'
            import_record.error_log = [str(e)]
            import_record.completed_at = timezone.now()
            import_record.save()
            raise serializers.ValidationError(f"Gagal memproses file CSV: {str(e)}")
        
class ContactImportResultSerializer(serializers.ModelSerializer):
    success_rate = serializers.ReadOnlyField()
    imported_by_name = serializers.CharField(source='imported_by.get_full_name', read_only=True)
    contact_list_name = serializers.CharField(source='contact_list.name', read_only=True)

    class Meta:
        model = ContactImport
        fields = [
            'import_id', 'filename', 'total_rows', 'processed_rows',
            'successful_imports', 'failed_imports', 'duplicate_emails',
            'status', 'success_rate', 'error_log', 'imported_by_name',
            'contact_list_name', 'started_at', 'completed_at'
        ]

class EmailTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        models = EmailTemplate
        fields = [
            'template_id', 'name', 'template_type', 'subject_line',
            'message_body', 'is_default', 'is_active', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['template_id', 'created_at', 'updated_at']

class SurveyInvitationSerializer(serializers.ModelSerializer):
    contact_email = serializers.CharField(source='contact.email', read_only=True)
    contact_name = serializers.CharField(source='contact.display_name', read_only=True)
    survey_title = serializers.CharField(source='survey.title', read_only=True)
    sent_by_name = serializers.CharField(source='sent_by.get_full_name', read_only=True)
    survey_url = serializers.ReadOnlyField()

    class Meta:
        model = SurveyInvitation
        fields = [
            'invitation_id', 'contact', 'contact_email', 'contact_name',
            'survey_title', 'subject_line', 'message_body', 'sender_email',
            'sender_name', 'status', 'survey_url', 'sent_by_name',
            'sent_at', 'delivered_at', 'opened_at', 'clicked_at',
            'responded_at', 'error_message', 'created_at'
        ]
        read_only_fields = [
            'invitation_id', 'survey_url', 'sent_at', 'delivered_at',
            'opened_at', 'clicked_at', 'responded_at', 'created_at'
        ]

class BulkInvitationSerializer(serializers.Serializer):
    survey_id = serializers.UUIDField()
    contact_list_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False
    )
    contact_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False
    )
    email_template_id = serializers.UUIDField(required=False)
    subject_line = serializers.CharField(max_length=255, required=False)
    message_body = serializers.CharField(required=False)
    sender_email = serializers.EmailField(required=False)
    sender_name = serializers.CharField(max_length=255, required=False)
    send_immediately = serializers.BooleanField(default=True)
    scheduled_at = serializers.DateTimeField(required=False)

    def validate(self, data):
        if not data.get('contact_list_ids') and not data.get('contact_ids'):
            raise serializers.ValidationError("Harus pilih contact list atau contact individual")
        if not data.get('send_immediately'):
            if not data.get('scheduled_at'):
                raise serializers.ValidationError("Harus tentukan waktu pengiriman jika tidak kirim sekarang")
        return data
    
    def validate_survey_id(self, value):
        organization = self.context.get('organization')
        try:
            survey = Survey.objects.get(
                survey_id=value,
                organization=organization
            )
            return survey
        except Survey.DoesNotExist:
            raise serializers.ValidationError("Survey tidak ditemukan")
    
    def validate_email_template_id(self, value):
        if not value:
            return None
        organization = self.context.get('organization')
        try:
            template = EmailTemplate.objects.get(
                template_id=value,
                organization=organization,
                is_active=True
            )
            return template
        except EmailTemplate.DoesNotExist:
            raise serializers.ValidationError("Email template tidak ditemukan")
        
class EmailCampaignSerializer(serializers.ModelSerializer):
    delivery_rate = serializers.ReadOnlyField()
    open_rate = serializers.ReadOnlyField()
    click_rate = serializers.ReadOnlyField()
    survey_title = serializers.CharField(source='survey.title', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = EmailCampaign
        fields = [
            'campaign_id', 'name', 'survey', 'survey_title', 'status',
            'contact_lists', 'subject_line', 'message_body', 'sender_name',
            'sender_email', 'scheduled_at', 'total_recipients', 'emails_sent',
            'emails_delivered', 'emails_opened', 'emails_clicked', 'emails_failed',
            'delivery_rate', 'open_rate', 'click_rate', 'created_by_name',
            'created_at', 'started_at', 'completed_at'
        ]
        read_only_fields = [
            'campaign_id', 'total_recipients', 'emails_sent',
            'emails_delivered', 'emails_opened', 'emails_clicked',
            'emails_failed', 'created_at', 'started_at', 'completed_at'
        ]

class EmailCampaignCreateSerializer(serializers.ModelSerializer):
    contact_list_ids = serializers.ListField(
        child = serializers.UUIDField(),
        write_only = True
    )

    class Meta:
        model = EmailCampaign
        fields = [
            'name', 'survey', 'email_template', 'subject_line', 'message_body',
            'sender_name', 'sender_email', 'scheduled_at', 'contact_list_ids'
        ]
    
    def validate_survey(self, value):
        if value.status != 'active':
            raise serializers.ValidationError("Survey harus dalam status active!")
        return value
    
    def create(self, validated_data):
        contact_list_ids = validated_data.pop('contact_list_ids')
        organization = self.contect['organization']
        user = self.context['user']
        campaign = EmailCampaign.objects.create(
            organization = organization,
            created_by = user,
            status = 'draft',
            **validated_data
        )
        contact_lists = ContactList.objects.filter(
            list_id__in = contact_list_ids,
            organization = organization
        )
        campaign.contact_lists.set(contact_lists)
        total = Contact.objects.filter(
            contact_lists__in = contact_lists,
            is_active = True,
            status = 'subscribed'
        ).distinct().count()
        campaign.total_recipients = total
        campaign.save()

        return campaign

class InvitationTrackingSerializer(serializers.ModelSerializer):
    contact_email = serializers.CharField(source='invitation.contact.email', read_only=True)

    class Meta:
        model = InvitationTracking
        fields = [
            'tracking_id', 'contact_email', 'opened_count', 'clicked_count',
            'first_opened_at', 'last_opened_at', 'first_clicked_at',
            'last_clicked_at', 'user_agent', 'ip_address'
        ]