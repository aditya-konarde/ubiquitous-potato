import { parseOpenAiResponse, parseProviderMessagesResponse, AiError, callAi } from '@/shared/ai-client';
import type { AiSettings } from '@/shared/types';

describe('parseOpenAiResponse', () => {
  it('extracts content from a valid configured provider response', () => {
    const body = { choices: [{ message: { content: 'Hello world' } }] };
    expect(parseOpenAiResponse(body, 'configured provider')).toBe('Hello world');
  });

  it('throws on missing choices', () => {
    expect(() => parseOpenAiResponse({}, 'configured provider')).toThrow(AiError);
  });

  it('throws on empty content', () => {
    expect(() => parseOpenAiResponse({ choices: [{ message: {} }] }, 'configured provider')).toThrow(AiError);
  });
});

describe('parseProviderMessagesResponse', () => {
  it('extracts text from a valid configured provider response', () => {
    const body = { content: [{ type: 'text', text: 'Hello from configured model' }] };
    expect(parseProviderMessagesResponse(body)).toBe('Hello from configured model');
  });

  it('throws on missing content', () => {
    expect(() => parseProviderMessagesResponse({})).toThrow(AiError);
  });

  it('throws on non-text content block', () => {
    expect(() => parseProviderMessagesResponse({ content: [{ type: 'image' }] })).toThrow(AiError);
  });
});

describe('callAi', () => {
  const settings: AiSettings = { enabled: true, provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' };

  it('throws not_configured when no API key', async () => {
    const noKey: AiSettings = { ...settings, apiKey: '' };
    await expect(callAi(noKey, 'sys', 'user')).rejects.toThrow(AiError);
    await expect(callAi(noKey, 'sys', 'user')).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('throws network error on fetch failure', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('Failed to fetch')));
    try {
      await expect(callAi(settings, 'sys', 'user')).rejects.toMatchObject({ code: 'network' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throws invalid_key on 401 response', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') }),
    );
    try {
      await expect(callAi(settings, 'sys', 'user')).rejects.toMatchObject({ code: 'invalid_key' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throws rate_limit on 429 response', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: false, status: 429, text: () => Promise.resolve('Too many') }),
    );
    try {
      await expect(callAi(settings, 'sys', 'user')).rejects.toMatchObject({ code: 'rate_limit' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns parsed content on success', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ choices: [{ message: { content: '["a","b","c"]' } }] }),
      }),
    );
    try {
      const result = await callAi(settings, 'sys', 'user');
      expect(result).toBe('["a","b","c"]');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
