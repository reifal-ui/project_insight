from django.core.management.base import BaseCommand
from django.utils import timezone
from users.models import Organization

class Command(BaseCommand):
    help = 'Check and expire subscriptions'

    def handle(self, *args, **options):
        now = timezone.now()
        expired = Organization.objects.filter(
            subscription_status = 'active',
            subscription_expires_at__lte = now
        )
        count = 0
        for org in expired:
            org.subscription_plan = 'starter'
            org.subscription_status = 'expired'
            org.save()
            count += 1
            self.stdout.write(
                self.style.WARNING(f'Expired: {org.name} subscription')
            )
        self.stdout.write(
            self.style.SUCCESS(f'Processed {count} ecpired subscriptions')
        )