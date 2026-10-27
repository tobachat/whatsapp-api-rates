# Route inbound WhatsApp messages to Slack with after-hours reply

Receive customer messages from the WhatsApp Business Cloud API, post them to Slack, reply automatically outside office hours and honour STOP requests. Every Slack message shows when the 24 hour reply window closes.

## Who is this for
Small teams that want WhatsApp questions in Slack before they invest in an inbox tool.

## How it works
1. A WhatsApp Trigger receives messages.
2. A Code node classifies by keyword, checks office hours in your time zone and computes the end of the 24 hour window.
3. STOP goes to an opt-out sheet with a confirmation.
4. Other messages are posted in Slack; outside hours the customer gets an automatic text reply.

## Setup
- Credentials for WhatsApp Trigger, WhatsApp Business Cloud, Slack and Google Sheets.
- Edit routes, hours and time zone at the top of the Code node.
- Duplicate the Slack node per topic if you want separate channels.

## Notes
Free-form replies only work inside the 24 hour window; after it closes use an approved template. Only one WhatsApp Trigger can exist per Meta app. Replying from Slack back to the customer is not included, to keep the template simple.

Rates data: [Tobachat open dataset](https://tobachat.nl/en/whatsapp-api-pricing-by-country/)

Author: Tobachat
