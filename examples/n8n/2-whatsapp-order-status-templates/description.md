# Send order status updates with WhatsApp templates and track delivery

Send an approved WhatsApp template when an order is confirmed, shipped or delivered, and keep a log that shows whether each message was sent, delivered, read or failed.

## Who is this for
Shops and service businesses on the WhatsApp Business Cloud API that want order notifications without a bot.

## How it works
1. Your shop POSTs the order event to a webhook.
2. A Code node maps the status to a template and its variables.
3. The WhatsApp Business Cloud node sends the template; the message id is stored in Google Sheets.
4. A WhatsApp Trigger receives status webhooks and updates the row (sent, delivered, read, failed, with the error code).

## Setup
- Three approved templates (names are set in the Code node), WhatsApp credentials, Google Sheets credentials.
- Your phone number id and spreadsheet id in the nodes.

## Notes
Only message customers who opted in, and keep utility templates free of promotion. Only one WhatsApp Trigger can exist per Meta app, so if you combine this with other templates, merge the trigger branches into one workflow.

Rates data: [Tobachat open dataset](https://tobachat.nl/en/whatsapp-api-pricing-by-country/)

Author: Tobachat
