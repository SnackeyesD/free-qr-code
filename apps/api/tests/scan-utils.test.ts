import { describe, it, expect } from 'vitest';
import { anonymizeIp, parseDeviceFamily, startOfDay } from '../src/services/scan.js';

describe('scan utilities', () => {
  it('anonymizes IPv4 last octet', () => {
    expect(anonymizeIp('203.0.113.45')).toBe('203.0.113.0');
    expect(anonymizeIp('unknown')).toBe('unknown');
    expect(anonymizeIp('::1')).toBe('::1');
  });

  it('parses device family from user agent', () => {
    expect(parseDeviceFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iPhone');
    expect(parseDeviceFamily('Mozilla/5.0 (Linux; Android 14)')).toBe('Android');
    expect(parseDeviceFamily('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows');
    expect(parseDeviceFamily('')).toBe('Desktop / Autre');
  });

  it('returns start of day in UTC', () => {
    const d = new Date('2026-07-29T14:30:00.000Z');
    expect(startOfDay(d).toISOString()).toBe('2026-07-29T00:00:00.000Z');
  });
});
