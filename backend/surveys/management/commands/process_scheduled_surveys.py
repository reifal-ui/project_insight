from django.core.management.base import BaseCommand
from django.utils import timezone
<<<<<<< HEAD
from surveys.models import Survey
from surveys.models import SurveyAnalytics
=======
from surveys.models import Survey, SurveyAnalytics

>>>>>>> f163a3e (FE DAN BE FIX)

class Command(BaseCommand):
    help = 'Process scheduled surveys (publish and close)'

    def handle(self, *args, **options):
        now = timezone.now()
        to_publish = Survey.objects.filter(
<<<<<<< HEAD
            status = 'draft',
            published_at__lte = now,
            published_at__isnull = False
        )
=======
            status='draft',
            published_at__lte=now,
            published_at__isnull=False
        )
        
>>>>>>> f163a3e (FE DAN BE FIX)
        published_count = 0
        for survey in to_publish:
            survey.status = 'active'
            survey.save(update_fields=['status'])
            published_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Published survey: {survey.title}')
            )
<<<<<<< HEAD
        to_close = Survey.objects.filter(
            status = 'active',
            closes_at__lte = now,
            closes_at__isnull = False
        )
=======
        
        to_close = Survey.objects.filter(
            status='active',
            closes_at__lte=now,
            closes_at__isnull=False
        )
        
>>>>>>> f163a3e (FE DAN BE FIX)
        closed_count = 0
        for survey in to_close:
            survey.status = 'closed'
            survey.save(update_fields=['status'])
<<<<<<< HEAD
            analytics, _ = SurveyAnalytics.objects.get_or_create(survey = survey)
            analytics.recalculate()
=======
            analytics, _ = SurveyAnalytics.objects.get_or_create(survey=survey)
            analytics.recalculate()
            
>>>>>>> f163a3e (FE DAN BE FIX)
            closed_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Closed survey: {survey.title}')
            )
<<<<<<< HEAD
        self.stdout.write(
            self.style.SUCCESS(
                f'\npROCESSED: {published_count} published, {closed_count} closed.'
=======
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nProcessed: {published_count} published, {closed_count} closed'
>>>>>>> f163a3e (FE DAN BE FIX)
            )
        )