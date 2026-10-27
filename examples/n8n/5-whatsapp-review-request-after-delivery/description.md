# Request a review on WhatsApp after delivery

Wait a few days after delivery, then send one approved WhatsApp template with a review link button, only to customers who opted in.

## Who is this for
Shops and service businesses that want more reviews and already use the WhatsApp Business Cloud API.

## How it works
1. Your shop POSTs the delivered event with the opt-in flag.
2. A Code node validates it; the webhook answers immediately.
3. A Wait node pauses for three days.
4. The WhatsApp node sends the template with a URL button; the request is logged in Google Sheets.

## Setup
- An approved template review_request with one body variable and a URL button with a variable suffix.
- WhatsApp Business Cloud and Google Sheets credentials; phone number id and spreadsheet id.

## Notes
Meta may categorise review requests as marketing, so collect marketing opt-in and expect the marketing rate. The Wait node stores executions, so keep execution data saving enabled in your instance.

Rates data: [Tobachat open dataset](https://tobachat.nl/en/whatsapp-api-pricing-by-country/)

Author: Tobachat
