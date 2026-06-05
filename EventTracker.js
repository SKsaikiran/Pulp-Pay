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
    return event;
  }

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
