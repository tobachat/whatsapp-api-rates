# n8n templates

Five importable workflows (`workflow.json`) with a description each. Import via n8n: Workflows, Import from file.

| Folder | What it does |
| --- | --- |
| `1-whatsapp-optin-consent-log` | Opt-in capture with consent log and confirmation template |
| `2-whatsapp-order-status-templates` | Order status updates with WhatsApp templates and delivery tracking |
| `3-whatsapp-inbound-router-slack` | Routes inbound messages to Slack with an after-hours reply |
| `4-whatsapp-monthly-cost-estimator` | Estimates monthly Meta message cost from planned sends, using `data/latest/EUR.csv` from this repo |
| `5-whatsapp-review-request-after-delivery` | Requests a review on WhatsApp after delivery |

Only one WhatsApp Trigger can exist per Meta app; templates 1 to 3 each contain one, so merge them if you use several.
Rates data: [Tobachat open dataset](https://tobachat.nl/en/whatsapp-api-pricing-by-country/).
