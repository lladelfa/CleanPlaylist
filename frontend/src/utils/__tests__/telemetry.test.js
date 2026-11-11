import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSessionAnonId,
  getViewportClass,
  getTrackCountBucket,
  emitTelemetryEvent,
} from '../telemetry';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

describe('telemetry utility module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    delete window.__CP_ANALYTICS_HOOK__;
  });

  afterEach(() => {
    sessionStorage.clear();
    delete window.__CP_ANALYTICS_HOOK__;
  });

  describe('getSessionAnonId', () => {
    it('creates and persists a valid UUID in sessionStorage', () => {
      const id1 = getSessionAnonId();
      expect(id1).toMatch(UUID_REGEX);
      expect(sessionStorage.getItem('cp_session_anon_id')).toBe(id1);

      // Re-call returns the exact same persisted ID
      const id2 = getSessionAnonId();
      expect(id2).toBe(id1);
    });

    it('replaces an invalid non-UUID value in sessionStorage with a valid UUID', () => {
      sessionStorage.setItem('cp_session_anon_id', 'invalid-token-123');
      const newId = getSessionAnonId();
      expect(newId).toMatch(UUID_REGEX);
      expect(sessionStorage.getItem('cp_session_anon_id')).toBe(newId);
    });
  });

  describe('getViewportClass', () => {
    it('returns "mobile" for viewport width < 768px', () => {
      window.innerWidth = 500;
      expect(getViewportClass()).toBe('mobile');
    });

    it('returns "desktop" for viewport width >= 768px', () => {
      window.innerWidth = 1024;
      expect(getViewportClass()).toBe('desktop');

      window.innerWidth = 768;
      expect(getViewportClass()).toBe('desktop');
    });
  });

  describe('getTrackCountBucket', () => {
    it('correctly categorizes track counts into AD-9 buckets', () => {
      expect(getTrackCountBucket(1)).toBe('1-10');
      expect(getTrackCountBucket(10)).toBe('1-10');
      expect(getTrackCountBucket(0)).toBe('1-10');
      expect(getTrackCountBucket(-5)).toBe('1-10');
      expect(getTrackCountBucket(null)).toBe('1-10');

      expect(getTrackCountBucket(11)).toBe('11-25');
      expect(getTrackCountBucket(25)).toBe('11-25');

      expect(getTrackCountBucket(26)).toBe('26-50');
      expect(getTrackCountBucket(50)).toBe('26-50');

      expect(getTrackCountBucket(51)).toBe('51+');
      expect(getTrackCountBucket(100)).toBe('51+');
    });
  });

  describe('emitTelemetryEvent', () => {
    it('uses navigator.sendBeacon when available', () => {
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      navigator.sendBeacon = sendBeaconMock;

      const success = emitTelemetryEvent('input_loaded', {
        platform: 'spotify',
        vip_mode: false,
        input_type: 'song_search',
        track_count_bucket: '1-10',
      });

      expect(success).toBe(true);
      expect(sendBeaconMock).toHaveBeenCalledWith(
        '/api/telemetry/event',
        expect.any(Blob)
      );
    });

    it('falls back to fetch with keepalive: true when sendBeacon is unavailable or returns false', async () => {
      navigator.sendBeacon = vi.fn().mockReturnValue(false);
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
      global.fetch = fetchMock;

      const success = emitTelemetryEvent('scan_completed', {
        platform: 'ytmusic',
        vip_mode: true,
        preset_id: 'kid_safe',
        track_count: 25,
        flagged_count: 3,
        lyrics_unavailable_count: 2,
      });

      expect(success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/telemetry/event',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: expect.stringContaining('"scan_completed"'),
        })
      );
    });

    it('invokes window.__CP_ANALYTICS_HOOK__ when registered', () => {
      const hookMock = vi.fn();
      window.__CP_ANALYTICS_HOOK__ = hookMock;

      emitTelemetryEvent('clean_swap_applied', {
        platform: 'spotify',
        vip_mode: false,
        mode: 'bulk',
        swapped_count: 4,
        unfound_count: 1,
      });

      expect(hookMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'clean_swap_applied',
          platform: 'spotify',
          vip_mode: false,
          mode: 'bulk',
          swapped_count: 4,
          unfound_count: 1,
          session_anon_id: expect.stringMatching(UUID_REGEX),
        })
      );
    });

    it('catches and silences network errors without throwing', () => {
      navigator.sendBeacon = vi.fn().mockImplementation(() => {
        throw new Error('Beacon error');
      });
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      expect(() => {
        emitTelemetryEvent('stitch_completed', {
          platform: 'ytmusic',
          source_count: 2,
          clean_rule: 'replace_clean_or_drop',
          output_count: 30,
        });
      }).not.toThrow();
    });

    it('builds valid AD-9 finish_action_clicked schema and accepts payload object', () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      delete navigator.sendBeacon;
      global.fetch = fetchMock;

      emitTelemetryEvent({
        event: 'finish_action_clicked',
        platform: 'spotify',
        vip_mode: true,
        action: 'vip_spotify_save',
      });

      expect(fetchMock).toHaveBeenCalled();
      const bodyStr = fetchMock.mock.calls[0][1].body;
      const parsed = JSON.parse(bodyStr);

      expect(parsed).toEqual(
        expect.objectContaining({
          event: 'finish_action_clicked',
          platform: 'spotify',
          vip_mode: true,
          action: 'vip_spotify_save',
          session_anon_id: expect.stringMatching(UUID_REGEX),
        })
      );
    });
  });
});
