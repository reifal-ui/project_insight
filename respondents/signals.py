from django.db.models.signals import post_save
from django.dispatch import receiver
from users.models import Organization
from .models import create_default_email_templates

@receiver(post_save, sender=Organization)
def create_default_templates(sender, instance, created, **kwargs):
    """Create default email templates when new organization is created"""
    if created and hasattr(instance, 'owner_user'):
        create_default_email_templates(instance, instance.owner_user)