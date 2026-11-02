import { describe, expect, test } from 'bun:test';
import { formatMaskedJson, maskSecrets } from '../src/features/authFiles/secretMask';

describe('auth file secret masking', () => {
  test('masks token-like values while keeping first and last four characters', () => {
    const masked = maskSecrets({
      access_token: 'abcd1234567890wxyz',
      refresh_token: 'short',
      email: 'dev@example.com',
      token_type: 'Bearer',
      expires_at: '2027-01-01T00:00:00Z',
    }) as Record<string, string>;
    expect(masked.access_token).toBe('abcd…wxyz');
    expect(masked.refresh_token).toBe('•••••');
    expect(masked.email).toBe('dev@example.com');
    expect(masked.token_type).toBe('Bearer');
    expect(masked.expires_at).toBe('2027-01-01T00:00:00Z');
  });

  test('masks nested secret objects and api-key account identifiers', () => {
    const masked = maskSecrets({
      siwc: { access_token: 'siwc-access-token-value' },
      tokens: { id_token: 'id-token-value-xyz', plan: 'pro' },
      account_type: 'api_key',
      account: 'sk-live-0123456789',
    }) as Record<string, Record<string, string> | string>;
    expect((masked.siwc as Record<string, string>).access_token).toBe('siwc…alue');
    expect((masked.tokens as Record<string, string>).id_token).toBe('id-t…-xyz');
    expect(masked.account).toBe('sk-l…6789');
  });

  test('leaves unparseable text untouched', () => {
    expect(formatMaskedJson('not json')).toBe('not json');
    expect(formatMaskedJson('{"api_key":"0123456789abcdef"}')).toBe(
      '{\n  "api_key": "0123…cdef"\n}'
    );
  });
});
