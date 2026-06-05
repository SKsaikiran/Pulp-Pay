export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    // Allow POST only
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    try {
      // Rate limit per IP
      const ip =
        request.headers.get('cf-connecting-ip') || 'unknown';

      const limitKey = `ratelimit:${ip}`;

      let count = await env.RATE_LIMIT.get(limitKey);
      count = parseInt(count || '0', 10);

      if (count >= 100) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded'
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      await env.RATE_LIMIT.put(
        limitKey,
        String(count + 1),
        {
          expirationTtl: 3600
        }
      );

      // Parse payload
      const data = await request.json();

      if (!data.events || !Array.isArray(data.events)) {
        return new Response(
          JSON.stringify({
            error: 'events array required'
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      if (data.events.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            processed: 0
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      const groupedEvents = {};

      // Route events to correct tables
      for (const event of data.events) {
        if (
          !event.event_id ||
          !event.user_id ||
          !event.event_type ||
          !event.feature
        ) {
          continue;
        }

        let tableName = '';

        if (
          event.event_type === 'page_impression' &&
          event.feature === 'home_page'
        ) {
          tableName = 'home_page_impressions';
        } else if (
          event.event_type === 'scan_click' &&
          event.feature === 'scan_qr'
        ) {
          tableName = 'scan_qr_clicks';
        } else if (
          event.event_type === 'toggle_click' &&
          event.feature === 'relay_toggle'
        ) {
          tableName = 'relay_toggle_clicks';
        } else if (
          event.event_type === 'slide_request_click' &&
          event.feature === 'send_request'
        ) {
          tableName = 'send_request_clicks';
        } else if (
          event.event_type === 'page_impression' &&
          event.feature === 'payment_success'
        ) {
          tableName = 'payment_success_impressions';
        } else {
          continue;
        }

        if (!groupedEvents[tableName]) {
          groupedEvents[tableName] = [];
        }

        groupedEvents[tableName].push(event);
      }

      const supabaseUrl = 'YOUR-SUPABASE-PROJECT-URL'; //Paste your Supabase Project Url in your project home page.
      const supabaseKey = 'SUPABASE-SECRET-KEY'; //Find the secret key in project setting under API page.

      if (!supabaseUrl || !supabaseKey) {
        return new Response(
          JSON.stringify({
            error: 'Supabase secrets missing'
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      let totalProcessed = 0;

      // Bulk insert per table
      for (const [tableName, records] of Object.entries(groupedEvents)) {
        if (!records.length) continue;

        const response = await fetch(
          `${supabaseUrl}/rest/v1/${tableName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal'
            },
            body: JSON.stringify(records)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          console.error(
            'Supabase error:',
            tableName,
            errorText
          );

          return new Response(
            JSON.stringify({
              error: 'Supabase insert failed',
              table: tableName,
              details: errorText
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            }
          );
        }

        totalProcessed += records.length;
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: totalProcessed,
          tables: Object.keys(groupedEvents)
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Worker error:', error);

      return new Response(
        JSON.stringify({
          error: error.message || 'Internal server error'
        }),
        {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          }
        }
      );
    }
  }
};