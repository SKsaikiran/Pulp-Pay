import { serve } from "https://deno.land/std/http/server.ts";

const EVENT_MAP: Record<string, string> = {
  home_page_impressions: "Home Page Impression",
  scan_qr_clicks: "Scan QR Click",
  relay_toggle_clicks: "Relay Toggle Click",
  send_request_clicks: "Send Request Click",
  payment_success_impressions: "Payment Success Impression",
};

serve(async (req) => {
  try {
    const mixpanelToken = Deno.env.get("MIXPANEL_TOKEN");

    if (!mixpanelToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "MIXPANEL_TOKEN not configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const payload = await req.json();

    console.log("Webhook payload:", JSON.stringify(payload));

    const tableName = payload.table;
    const record = payload.record ?? {};

    const eventName = EVENT_MAP[tableName];

    if (!eventName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unknown table: ${tableName}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!record.user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "user_id is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const mixpanelEvent = {
      event: eventName,
      properties: {
        token: mixpanelToken,
        distinct_id: String(record.user_id),
        time: Math.floor(Date.now() / 1000),

        source: "supabase",
        event_source: "backend",
        table_name: tableName,

        ...record,
      },
    };

    console.log(
      "Sending Mixpanel event:",
      JSON.stringify(mixpanelEvent)
    );

    const mixpanelResponse = await fetch(
      "https://api.mixpanel.com/track?verbose=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(
          JSON.stringify(mixpanelEvent)
        )}`,
      }
    );

    const responseText = await mixpanelResponse.text();

    console.log("Mixpanel status:", mixpanelResponse.status);
    console.log("Mixpanel body:", responseText);

    return new Response(
      JSON.stringify({
        success: true,
        event: eventName,
        mixpanel_response: responseText,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Function Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});