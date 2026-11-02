import { describe, expect, spyOn, test } from 'bun:test';
import { apiClient } from '../src/services/api/client';
import { pluginsApi, pluginStoreApi } from '../src/services/api/plugins';

describe('plugin responses escaped by the backend', () => {
  test('store entries show the registry text, not HTML entities', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue({
      plugins: [
        {
          id: 'headroom',
          name: 'Headroom Compression &amp; Stats',
          description: 'Enables CPA&#39;s native tools: {&#34;input&#34;: string} &lt;b&gt;',
          logo: 'https://avatars.githubusercontent.com/u/1?s=64&amp;v=4',
          tags: ['a &amp; b'],
        },
      ],
    });
    try {
      const [entry] = (await pluginStoreApi.list()).plugins;
      expect(entry.name).toBe('Headroom Compression & Stats');
      expect(entry.description).toBe('Enables CPA\'s native tools: {"input": string} <b>');
      expect(entry.logo).toBe('https://avatars.githubusercontent.com/u/1?s=64&v=4');
      expect(entry.tags).toEqual(['a & b']);
    } finally {
      get.mockRestore();
    }
  });

  test('installed plugins are unescaped exactly once', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue({
      plugins: [{ id: 'demo', metadata: { name: 'Literal &amp;lt; stays &amp;lt;' } }],
    });
    try {
      const [entry] = (await pluginsApi.list()).plugins;
      expect(entry.metadata?.name).toBe('Literal &lt; stays &lt;');
    } finally {
      get.mockRestore();
    }
  });
});
