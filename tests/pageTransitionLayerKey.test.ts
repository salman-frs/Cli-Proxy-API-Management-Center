import { describe, expect, test } from 'bun:test';
import { resolveLayerKey } from '@/components/common/PageTransition';

describe('page transition layer keys', () => {
  test('keeps router-created location keys', () => {
    expect(resolveLayerKey({ key: 'abc123', pathname: '/logs', search: '' })).toBe('abc123');
  });

  test('tells apart manual hash edits, which all share the "default" key', () => {
    const logs = resolveLayerKey({ key: 'default', pathname: '/logs', search: '' });
    const config = resolveLayerKey({ key: 'default', pathname: '/config', search: '' });
    const filtered = resolveLayerKey({ key: 'default', pathname: '/logs', search: '?level=error' });
    expect(new Set([logs, config, filtered]).size).toBe(3);
  });
});
