# Supabase → Mixpanel Integration Guide

This guide explains how to connect Supabase event tables to Mixpanel using Database Webhooks and Edge Functions.

The setup allows every event inserted into a Supabase table to be automatically sent to Mixpanel for analytics and funnel tracking.

---

# Architecture

```text
User Action
    ↓
Insert Event into Supabase Table
    ↓
Supabase Database Webhook
    ↓
Supabase Edge Function
    ↓
Mixpanel
```

---

# Prerequisites

Before starting, ensure you have:

- A Supabase project
- Event tables already created in Supabase
- A Mixpanel account

---
### Why Use Database Webhooks?

Database Webhooks are used to automatically trigger analytics processing whenever a new event row is inserted into a Supabase table. This approach keeps tracking independent of the frontend, ensures events are generated from actual database activity, reduces the chance of missed events due to client-side failures, and allows the application to focus only on writing event data while Supabase handles triggering the analytics pipeline.

### Why Use an Edge Function?

The Edge Function acts as a centralized analytics layer between Supabase and Mixpanel. It securely manages the Mixpanel token, maps database table names to human-readable event names, enriches events with additional metadata, and provides a single location for all analytics logic. This makes the integration easier to maintain, more secure, and simpler to extend in the future without requiring changes to the application code.

---

# Step 1: Create a Mixpanel Project

1. Sign in to Mixpanel.
2. Create a new project.
3. Open:

   Settings → Project Settings

4. Copy your:

   - Project Token

This token will be used by the Supabase Edge Function to send events to Mixpanel.

---

# Step 2: Verify Your Event Tables

Ensure your event tables exist in Supabase.

Example:

```text
home_page_impressions
scan_qr_clicks
relay_toggle_clicks
send_request_clicks
payment_success_impressions
```

Each table should contain a consistent identifier.

Example:

```sql
user_id TEXT NOT NULL
```

This value will be used as Mixpanel's:

```text
distinct_id
```

which enables funnel tracking and user journey analysis.

---

# Step 3: Create an Edge Function

Navigate to:

```text
Supabase Dashboard
→ Edge Functions
→ Create New Function
→ Via Editor
```

Function name:

```text
track-mixpanel
```

---

# Step 4: Add Mixpanel Secret

Navigate to:

```text
Supabase Dashboard
→ Edge Functions
→ Secrets
```

Create a new secret:

```text
MIXPANEL_TOKEN
```

Value:

```text
<YOUR_MIXPANEL_PROJECT_TOKEN>
```

---

# Step 5: Add Edge Function Code

Replace the generated function code with:

### [ Edge Function (Click for source code)](https://github.com/SKsaikiran/Pulp-Pay/blob/main/Event%20Tracker%20Pipeline/Supabase%20to%20Mixpanel/Edge_Function.ts)

Deploy the function.

---

# Step 6: Create Database Webhooks

Navigate to:

```text
Supabase Dashboard
→ Integrations
→ Database Webhooks
```
Or

```Search 'webhooks' in the Home page search bar.```

Create an INSERT webhook for each event table.

Example:

## Webhook 1

```text
Table:
home_page_impressions

Event:
INSERT

Target:
Edge Function

Function:
track-mixpanel
```

## Webhook 2

```text
scan_qr_clicks
INSERT
track-mixpanel
```

## Webhook 3

```text
relay_toggle_clicks
INSERT
track-mixpanel
```

## Webhook 4

```text
send_request_clicks
INSERT
track-mixpanel
```

## Webhook 5

```text
payment_success_impressions
INSERT
track-mixpanel
```

---

# Step 7: Test the Integration

Insert a test record into any event table.

Example:

```sql
INSERT INTO scan_qr_clicks (
    user_id
)
VALUES (
    'test-user-1'
);
```

---

# Step 8: Verify Event Delivery

Open:

```text
Mixpanel
→ Events
```

You should see:

```text
Scan QR Click
```

along with the event properties received from Supabase.

---

# Funnel Tracking

Because every event uses:

```text
distinct_id = user_id
```

Mixpanel can automatically build funnels such as:

```text
Home Page Impression
        ↓
Scan QR Click
        ↓
Relay Toggle Click
        ↓
Send Request Click
        ↓
Payment Success Impression
```

without requiring user profile data.

---

# Benefits

- Server-side event tracking
- No frontend analytics SDK required
- Reliable event delivery
- Centralized tracking logic
- Easy funnel creation
- Easy future expansion

---

# Final Flow

```text
User Action
    ↓
Supabase Event Table
    ↓
Database Webhook
    ↓
track-mixpanel Edge Function
    ↓
Mixpanel Event
    ↓
Funnels & Analytics
```
