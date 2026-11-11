/**
 * telemetry.js
 *
 * Client-side telemetry utility for CleanPlaylist.
 * Provides privacy-safe, zero-PII usage event logging conforming to the AD-9 schema.
 * Features:
 * - Anonymous session ID persisted in sessionStorage (no cookies)
 * - Viewport classification ('mobile' vs 'desktop')
 * - Track count bucketing ('1-10', '11-25', '26-50', '51+')
 * - Fire-and-forget event emission via navigator.sendBeacon with fetch keepalive fallback
 * - Optional window.__CP_ANALYTICS_HOOK__ hook invocation
 */

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
let inMemoryAnonId = null;

function safeNonNegativeInt(val) {
  return typeof val === 'number' && !isNaN(val) ? Math.max(0, Math.floor(val)) : 0;
}

/**
 * Generate a random UUID v4.
 * Uses crypto.randomUUID when available, with fallback.
 *
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieve or create and persist a privacy-safe anonymous session ID.
 * Persisted in sessionStorage under 'cp_session_anon_id'.
 *
 * @returns {string}
 */
export function getSessionAnonId() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const existing = window.sessionStorage.getItem('cp_session_anon_id');
      if (existing && UUID_REGEX.test(existing)) {
        return existing;
      }
      const newId = generateUUID();
      window.sessionStorage.setItem('cp_session_anon_id', newId);
      return newId;
    }
  } catch {
    // sessionStorage might be restricted (private browsing / sandboxed iframe)
  }
  if (!inMemoryAnonId) {
    inMemoryAnonId = generateUUID();
  }
  return inMemoryAnonId;
}

/**
 * Determine viewport classification ('mobile' | 'desktop') based on window width.
 * Standard Tailwind md breakpoint (< 768px is mobile).
 *
 * @returns {'mobile' | 'desktop'}
 */
export function getViewportClass() {
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return window.innerWidth < 768 ? 'mobile' : 'desktop';
  }
  return 'desktop';
}

/**
 * Map an integer track count to a privacy-safe categorical bucket.
 * Buckets: '1-10' | '11-25' | '26-50' | '51+'
 *
 * @param {number} count
 * @returns {'1-10' | '11-25' | '26-50' | '51+'}
 */
export function getTrackCountBucket(count) {
  const n = typeof count === 'number' && !isNaN(count) ? Math.max(0, count) : 0;
  if (n <= 10) return '1-10';
  if (n <= 25) return '11-25';
  if (n <= 50) return '26-50';
  return '51+';
}

/**
 * Sanitize and format payload to match AD-9 schema strictly, preventing forbidden keys.
 *
 * @param {Object} rawPayload
 * @returns {Object}
 */
function buildSchemaPayload(rawPayload) {
  const event = rawPayload.event;
  const platform = rawPayload.platform === 'ytmusic' ? 'ytmusic' : 'spotify';
  const viewport_class =
    rawPayload.viewport_class === 'mobile' || rawPayload.viewport_class === 'desktop'
      ? rawPayload.viewport_class
      : getViewportClass();
  const vip_mode = Boolean(rawPayload.vip_mode);
  const session_anon_id =
    typeof rawPayload.session_anon_id === 'string' && UUID_REGEX.test(rawPayload.session_anon_id)
      ? rawPayload.session_anon_id
      : getSessionAnonId();

  const base = {
    event,
    platform,
    viewport_class,
    vip_mode,
    session_anon_id,
  };

  switch (event) {
    case 'input_loaded':
      return {
        ...base,
        input_type: rawPayload.input_type,
        track_count_bucket: rawPayload.track_count_bucket || getTrackCountBucket(rawPayload.track_count || 1),
      };

    case 'scan_completed':
      return {
        ...base,
        preset_id: rawPayload.preset_id,
        track_count: safeNonNegativeInt(rawPayload.track_count),
        flagged_count: safeNonNegativeInt(rawPayload.flagged_count),
        lyrics_unavailable_count: safeNonNegativeInt(rawPayload.lyrics_unavailable_count),
      };

    case 'clean_swap_applied':
      return {
        ...base,
        mode: rawPayload.mode === 'single' ? 'single' : 'bulk',
        swapped_count: safeNonNegativeInt(rawPayload.swapped_count),
        unfound_count: safeNonNegativeInt(rawPayload.unfound_count),
      };

    case 'stitch_completed':
      return {
        ...base,
        source_count: safeNonNegativeInt(rawPayload.source_count),
        clean_rule: rawPayload.clean_rule,
        output_count: safeNonNegativeInt(rawPayload.output_count),
      };

    case 'finish_action_clicked':
      return {
        ...base,
        action: rawPayload.action,
      };

    default:
      return { ...base, ...rawPayload };
  }
}

/**
 * Emit a structured, privacy-safe telemetry event to POST /api/telemetry/event.
 * Fire-and-forget: never throws and never interrupts UI operations.
 *
 * @param {string|Object} eventNameOrPayload - Event name string or full payload object
 * @param {Object} [eventData={}] - Additional event-specific properties if eventName was string
 * @returns {boolean} Whether emission was dispatched without immediate failure
 */
export function emitTelemetryEvent(eventNameOrPayload, eventData = {}) {
  try {
    const raw =
      typeof eventNameOrPayload === 'object' && eventNameOrPayload !== null
        ? { ...eventNameOrPayload }
        : { event: eventNameOrPayload, ...eventData };

    if (!raw.event) {
      return false;
    }

    const payload = buildSchemaPayload(raw);

    // Dispatch optional analytics hook if defined
    if (typeof window !== 'undefined' && typeof window.__CP_ANALYTICS_HOOK__ === 'function') {
      try {
        window.__CP_ANALYTICS_HOOK__(payload);
      } catch {
        // Ignore errors from external hook
      }
    }

    const endpoint = '/api/telemetry/event';
    const jsonStr = JSON.stringify(payload);

    let sent = false;

    // Primary: navigator.sendBeacon for reliable delivery across unloads
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        sent = navigator.sendBeacon(endpoint, blob);
      } catch {
        sent = false;
      }
    }

    // Fallback: fetch with keepalive: true
    if (!sent && typeof fetch === 'function') {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr,
        keepalive: true,
      }).catch(() => {});
    }

    return true;
  } catch {
    // Fire-and-forget guarantee: never throw
    return false;
  }
}

export default emitTelemetryEvent;
