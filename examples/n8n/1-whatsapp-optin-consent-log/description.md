# WhatsApp opt-in capture with consent log and confirmation template

Collect a provable WhatsApp opt-in from any web form, log it in Google Sheets and confirm with an approved template. Replying STOP marks the contact as opted out.

## Who is this for
Anyone sending WhatsApp notifications or campaigns with the official WhatsApp Business Cloud API who needs a clean consent record before the first message.

## How it works
1. A form POSTs name, phone, consent and the exact consent text to a webhook.
2. A Code node validates the number and the explicit consent.
3. The record (timestamp, source, wording, IP) is appended to Google Sheets.
4. A WhatsApp template message confirms the sign-up.
5. A WhatsApp Trigger watches for STOP replies and marks the number as opted out.

## Setup
- Google Sheets, WhatsApp Business Cloud and WhatsApp Trigger credentials.
- A sheet with an "Opt-ins" tab (columns are listed in the sticky note).
- An approved template named optin_confirmation with one body variable.
- The webhook Production URL as the form action.

## Notes
Meta requires opt-in before messaging; this workflow stores the evidence and is not legal advice. Only one WhatsApp Trigger can exist per Meta app.

Rates data: [Tobachat open dataset](https://tobachat.nl/en/whatsapp-api-pricing-by-country/)

Author: Tobachat
