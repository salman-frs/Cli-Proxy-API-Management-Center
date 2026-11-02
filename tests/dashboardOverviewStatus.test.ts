import { describe, expect, test } from 'bun:test';
import { overviewStatus } from '../src/features/dashboard/utils';

describe('overviewStatus', () => {
  test('reports the connection state before any traffic signal', () => {
    expect(overviewStatus('connecting', 10, 3)).toBe('connecting');
    expect(overviewStatus('disconnected', 100, 0)).toBe('offline');
  });

  test('derives health from the success rate and unavailable credentials', () => {
    expect(overviewStatus('connected', 99, 0)).toBe('operational');
    expect(overviewStatus('connected', 99, 1)).toBe('degraded');
    expect(overviewStatus('connected', 85, 0)).toBe('degraded');
    expect(overviewStatus('connected', 50, 0)).toBe('failing');
  });

  test('stays idle without traffic unless credentials are unavailable', () => {
    expect(overviewStatus('connected', null, 0)).toBe('idle');
    expect(overviewStatus('connected', null, 2)).toBe('degraded');
  });
});
