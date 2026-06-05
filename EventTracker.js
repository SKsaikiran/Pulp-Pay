(function(){
  const STORAGE_KEY = 'pulpEvents';
  const USER_KEY = 'pulpUserId';
  const SESSION_KEY = 'pulpSessionId';
  const DEFAULT_SOURCE = 'home_page';

  const EVENT_KEY_MAP = {
    'page_impression:home_page': 'evt-1a2b-3c4d',
    'scan_click:scan_qr': 'evt-2b3c-4d5e',
    'toggle_click:relay_toggle': 'evt-3c4d-5e6f',
    'slide_request_click:send_request': 'evt-4d5e-6f7a',
    'page_impression:payment_success': 'evt-5e6f-7a8b'
  };

  function generateUUID(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
      const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }

  function getOrCreateUserId(){
    let id = localStorage.getItem(USER_KEY);
    if(!id){
      id = generateUUID();
      localStorage.setItem(USER_KEY,id);
    }
    return id;
  }

  function getOrCreateSessionId(){
    let id = sessionStorage.getItem(SESSION_KEY);
    if(!id){
      id = generateUUID();
      sessionStorage.setItem(SESSION_KEY,id);
    }
    return id;
  }

  function getStoredEvents(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveEvents(events){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn('EventTracker: failed to save events', e);
    }
  }

  function getDeviceType(){
    const ua = navigator.userAgent || '';
    if(/Mobi|Android|iPhone|iPad|iPod|Tablet|Mobile/i.test(ua)){
      return 'mobile';
    }
    return 'desktop';
  }

  function getEventKey(eventType, feature){
    return EVENT_KEY_MAP[`${eventType}:${feature}`] || 'evt-0000-0000';
  }

  function buildEvent(eventType, feature, options){
    const now = new Date().toISOString();
    const source = (options && options.source) || window.currentSource || DEFAULT_SOURCE;
    return {
      event_id: generateUUID(),
      event_key: getEventKey(eventType, feature),
      event_type: eventType || '',
      feature: feature || '',
      timestamp: now,
      user_id: getOrCreateUserId(),
      session_id: getOrCreateSessionId(),
      page: window.location.pathname || '',
      page_title: document.title || '',
      referrer: document.referrer || '',
      user_agent: navigator.userAgent || '',
      device_type: getDeviceType(),
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      browser_language: navigator.language || '',
      source: source,
      metadata: (options && options.metadata) ? options.metadata : {}
    };
  }

  function trackEvent(eventType, feature, options){
    const event = buildEvent(eventType, feature, options || {});
    const events = getStoredEvents();
    events.push(event);
    saveEvents(events);
    console.log('trackEvent', event);
    // attempt to deliver events soon (non-blocking)
    try { scheduleSend(); } catch(e){}
    return event;
  }

  /* Delivery / batching to Cloudflare Worker */
  const WORKER_ENDPOINT = 'https://pulp-pay.saikiranj2002.workers.dev/';
  const BATCH_SIZE = 25;
  const SEND_INTERVAL_MS = 5000; // minimum gap between sends
  const LAST_SEND_KEY = 'pulpEventsLastSend';
  let sendScheduled = false;

  function getLastSend(){
    return parseInt(localStorage.getItem(LAST_SEND_KEY) || '0', 10);
  }

  function setLastSend(ts){
    try{ localStorage.setItem(LAST_SEND_KEY, String(ts)); }catch(e){}
  }

  async function sendQueuedEvents(){
    // basic rate limit
    const now = Date.now();
    if(now - getLastSend() < SEND_INTERVAL_MS) return;
    const events = getStoredEvents();
    if(!events || events.length===0) return;

    const batch = events.slice(0, BATCH_SIZE);
    const payload = { events: batch };

    try{
      const resp = await fetch(WORKER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
        keepalive: true
      });
      setLastSend(now);
      if(resp.ok){
        // remove successfully sent events from storage
        const remaining = getStoredEvents().slice(batch.length);
        saveEvents(remaining);
      } else {
        // non-OK — do not drop events; back off slightly
        console.warn('EventTracker: worker responded', resp.status);
      }
    }catch(err){
      // network or CORS error — keep events and retry later
      setLastSend(now);
      console.warn('EventTracker: failed to send events', err);
    }
  }

  function scheduleSend(){
    if(sendScheduled) return;
    sendScheduled = true;
    setTimeout(()=>{ sendScheduled = false; sendQueuedEvents().catch(()=>{}); }, 800);
  }

  // periodic background sender and online retry
  window.addEventListener('online', ()=>{ try{ sendQueuedEvents().catch(()=>{}); }catch(e){} });
  setInterval(()=>{ try{ sendQueuedEvents().catch(()=>{}); }catch(e){} }, 10000);

  function setEventSource(source){
    window.currentSource = source || DEFAULT_SOURCE;
  }

  window.currentSource = window.currentSource || DEFAULT_SOURCE;
  window.paymentSuccessImpressionFired = false;
  window.trackEvent = trackEvent;
  window.setEventSource = setEventSource;
  window.EventTracker = {
    trackEvent,
    setEventSource,
    getStoredEvents,
    generateUUID
  };
})();
