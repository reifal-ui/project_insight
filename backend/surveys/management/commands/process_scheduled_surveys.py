from django.core.management.base import BaseCommand
from django.utils import timezone
from surveys.models import Survey
from surveys.models import SurveyAnalytics

class Command(BaseCommand):
    help = 'Process scheduled surveys (publish and close)'

    def handle(self, *args, **options):
        now = timezone.now()
        to_publish = Survey.objects.filter(
            status = 'draft',
            published_at__lte = now,
            published_at__isnull = False
        )
        published_count = 0
        for survey in to_publish:
            survey.status = 'active'
            survey.save(update_fields=['status'])
            published_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Published survey: {survey.title}')
            )
        to_close = Survey.objects.filter(
            status = 'active',
            closes_at__lte = now,
            closes_at__isnull = False
        )
        closed_count = 0
        for survey in to_close:
            survey.status = 'closed'
            survey.save(update_fields=['status'])
            analytics, _ = SurveyAnalytics.objects.get_or_create(survey = survey)
            analytics.recalculate()
            closed_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Closed survey: {survey.title}')
            )
        self.stdout.write(
            self.style.SUCCESS(
                f'\npROCESSED: {published_count} published, {closed_count} closed.'
            )
        )