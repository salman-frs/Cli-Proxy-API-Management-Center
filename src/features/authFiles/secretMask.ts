const SECRET_KEY_PATTERN =
  /(token|secret|api[_-]?key|password|passwd|cookie|authorization|private[_-]?key|credential)/i;
const METADATA_KEY_PATTERN = /(_type|_at|expir\w*)$/i;

const VISIBLE_EDGE = 4;
const MASK = '…';

const isSecretKey = (key: string): boolean =>
  SECRET_KEY_PATTERN.test(key) && !METADATA_KEY_PATTERN.test(key);

const maskSecretValue = (value: string): string => {
  if (value.length <= VISIBLE_EDGE * 2) return '•'.repeat(Math.max(value.length, 4));
  return `${value.slice(0, VISIBLE_EDGE)}${MASK}${value.slice(-VISIBLE_EDGE)}`;
};

const isApiKeyAccount = (record: Record<string, unknown>): boolean =>
  typeof record.account_type === 'string' && /api/i.test(record.account_type);

export const maskSecrets = (value: unknown, parentIsSecret = false): unknown => {
  if (typeof value === 'string') return parentIsSecret ? maskSecretValue(value) : value;
  if (Array.isArray(value)) return value.map((item) => maskSecrets(item, parentIsSecret));
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const maskAccount = isApiKeyAccount(record);
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      maskSecrets(child, parentIsSecret || isSecretKey(key) || (maskAccount && key === 'account')),
    ])
  );
};

export const formatMaskedJson = (text: string): string => {
  if (!text) return '';
  try {
    return JSON.stringify(maskSecrets(JSON.parse(text)), null, 2);
  } catch {
    return text;
  }
};
