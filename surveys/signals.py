from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Survey, SurveyAnalytics

@receiver(post_save, sender=Survey)
def create_survey_analytics(sender, instance, created, **kwargs):
    """Auto create analytics when survey is created"""
    if created:
        SurveyAnalytics.objects.get_or_create(survey=instance)