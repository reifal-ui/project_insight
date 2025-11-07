import requests
import hmac
import hashlib
import json
from django.utils import timezone
from .models import Webhook, WebhookDelivery
import logging

logger = logging.getLogger(__name__)

def send_webhook(organization, event_type, payload):
    """
    Send webhook to all active webhooks that listen to this event
    """
    webhooks = Webhook.objects.filter(
        organization=organization,
        is_active=True,
        events__contains=[event_type]
    )
    
    for webhook in webhooks:
        # Send synchronously for now (can be made async with Celery later)
        try:
            send_single_webhook(webhook.webhook_id, event_type, payload)
        except Exception as e:
            logger.error(f"Failed to send webhook {webhook.webhook_id}: {e}")

def send_single_webhook(webhook_id, event_type, payload):
    """
    Send single webhook delivery
    """
    try:
        webhook = Webhook.objects.get(webhook_id=webhook_id)
    except Webhook.DoesNotExist:
        logger.error(f"Webhook {webhook_id} not found")
        return
    
    # Create delivery record
    delivery = WebhookDelivery.objects.create(
        webhook=webhook,
        event_type=event_type,
        payload=payload,
        status='pending'
    )
    
    try:
        # Prepare payload
        webhook_payload = {
            'event': event_type,
            'timestamp': timezone.now().isoformat(),
            'data': payload
        }
        
        # Generate signature
        signature = generate_signature(webhook.secret, json.dumps(webhook_payload))
        
        # Send request
        headers = {
            'Content-Type': 'application/json',
            'X-Insight-Signature': signature,
            'X-Insight-Event': event_type,
            'User-Agent': 'ProjectInsight-Webhook/1.0'
        }
        
        response = requests.post(
            webhook.url,
            json=webhook_payload,
            headers=headers,
            timeout=10
        )
        
        # Update delivery record
        delivery.status = 'success' if response.status_code < 400 else 'failed'
        delivery.status_code = response.status_code
        delivery.response_body = response.text[:1000]  # Limit to 1000 chars
        delivery.delivered_at = timezone.now()
        delivery.save()
        
        # Update webhook
        webhook.last_triggered_at = timezone.now()
        
        if delivery.status == 'failed':
            webhook.failure_count += 1
            webhook.last_failure_at = timezone.now()
            webhook.last_failure_reason = f"HTTP {response.status_code}: {response.text[:200]}"
        else:
            # Reset failure count on success
            webhook.failure_count = 0
            webhook.last_failure_reason = ''
        
        webhook.save()
        
        logger.info(f"Webhook {webhook_id} delivered: {delivery.status}")
        
        # Auto-disable webhook after 10 consecutive failures
        if webhook.failure_count >= 10:
            webhook.is_active = False
            webhook.save()
            logger.warning(f"Webhook {webhook_id} auto-disabled after 10 failures")
        
        return delivery
        
    except requests.exceptions.Timeout:
        delivery.status = 'failed'
        delivery.error_message = 'Request timeout'
        delivery.save()
        
        webhook.failure_count += 1
        webhook.last_failure_at = timezone.now()
        webhook.last_failure_reason = 'Request timeout'
        webhook.save()
        
        logger.error(f"Webhook {webhook_id} timeout")
        
    except requests.exceptions.RequestException as e:
        delivery.status = 'failed'
        delivery.error_message = str(e)
        delivery.save()
        
        webhook.failure_count += 1
        webhook.last_failure_at = timezone.now()
        webhook.last_failure_reason = str(e)[:200]
        webhook.save()
        
        logger.error(f"Webhook {webhook_id} error: {e}")
    
    except Exception as e:
        delivery.status = 'failed'
        delivery.error_message = f"Unexpected error: {str(e)}"
        delivery.save()
        
        logger.error(f"Webhook {webhook_id} unexpected error: {e}")

def generate_signature(secret, payload):
    """
    Generate HMAC-SHA256 signature
    """
    signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"sha256={signature}"

def verify_signature(secret, payload, signature):
    """
    Verify webhook signature
    """
    expected = generate_signature(secret, payload)
    return hmac.compare_digest(expected, signature)