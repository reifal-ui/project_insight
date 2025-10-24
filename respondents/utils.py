import csv
import io
from django.http import HttpResponse
from django.utils import timezone

def export_contacts_csv(contacts, filename_prefix="contacts"):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    filename = f"{filename_prefix}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    headers = [
        'Email', 'First Name', 'Last Name', 'Phone', 'Company', 
        'Job Title', 'Status', 'Active', 'Created At', 'Last Contacted'
    ]
    writer.writerow(headers)
    
    for contact in contacts:
        row = [
            contact.email,
            contact.first_name or '',
            contact.last_name or '',
            contact.phone or '',
            contact.company or '',
            contact.job_title or '',
            contact.status,
            'Yes' if contact.is_active else 'No',
            contact.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            contact.last_contacted.strftime('%Y-%m-%d %H:%M:%S') if contact.last_contacted else ''
        ]
        writer.writerow(row)
    
    return response

def validate_csv_headers(file_content, required_headers=['email']):
    try:
        csv_reader = csv.DictReader(io.StringIO(file_content))
        headers = csv_reader.fieldnames or []
        missing_headers = [h for h in required_headers if h not in headers]
        if missing_headers:
            return False, f"Missing required headers: {', '.join(missing_headers)}"
        return True, "Valid headers"
    
    except Exception as e:
        return False, f"Invalid CSV format: {str(e)}"