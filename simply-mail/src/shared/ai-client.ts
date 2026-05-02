import type { AiSettings } from './types';

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid_key' | 'rate_limit' | 'network' | 'unknown' | 'not_configured',
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

function classifyError(error: unknown, provider: string): AiError {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('401') || msg.includes('403') || msg.includes('authentication') || msg.includes('invalid')) {
    return new AiError(`Invalid API key for ${provider}. Please check your settings.`, 'invalid_key', error);
  }
  if (msg.includes('429') || msg.includes('rate') || msg.includes('too many')) {
    return new AiError(`Rate limited by ${provider}. Please wait a moment and try again.`, 'rate_limit', error);
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    return new AiError('Network error. Please check your internet connection.', 'network', error);
  }

  return new AiError(`AI request failed: ${msg}`, 'unknown', error);
}

export function parseOpenAiResponse(body: unknown, provider: string): string {
  const obj = body as Record<string, unknown>;

  // Check for error objects first (configured provider often returns { error: { message: ... } } on 200/400)
  if (obj.error && typeof obj.error === 'object') {
    const errObj = obj.error as Record<string, unknown>;
    if (errObj.message) {
      throw new AiError(String(errObj.message), 'unknown');
    }
  }

  const choices = obj.choices as Array<Record<string, unknown>> | undefined;
  if (!choices?.[0]) {
    throw new AiError(`Unexpected ${provider} response format.`, 'unknown');
  }
  const message = choices[0].message as Record<string, unknown> | undefined;
  if (!message?.content) {
    throw new AiError(`Empty response from ${provider}.`, 'unknown');
  }
  return String(message.content);
}

export function parseProviderMessagesResponse(body: unknown): string {
  const obj = body as Record<string, unknown>;
  const content = obj.content as Array<Record<string, unknown>> | undefined;
  if (!content?.[0]) {
    throw new AiError('Unexpected configured provider response format.', 'unknown');
  }
  if (content[0].type !== 'text' || !content[0].text) {
    throw new AiError('Empty response from configured provider.', 'unknown');
  }
  return String(content[0].text);
}

export async function callAi(
  settings: AiSettings,
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number },
): Promise<string> {
  if (!settings.apiKey) {
    throw new AiError('AI is not configured. Please add your API key in Simply Mail settings.', 'not_configured');
  }

  const maxTokens = options?.maxTokens ?? 1024;

  if (settings.provider === 'openai') {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw classifyError(
          new Error(`configured provider API error ${response.status}: ${errorBody}`),
          'configured provider',
        );
      }

      const body = await response.json();
      return parseOpenAiResponse(body, 'configured provider');
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw classifyError(err, 'configured provider');
    }
  }

  if (settings.provider === 'anthropic') {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw classifyError(
          new Error(`configured provider API error ${response.status}: ${errorBody}`),
          'configured provider',
        );
      }

      const body = await response.json();
      return parseProviderMessagesResponse(body);
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw classifyError(err, 'configured provider');
    }
  }

  if (settings.provider === 'openrouter') {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'https://github.com/simply-mail',
          'X-Title': 'Simply Mail',
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw classifyError(
          new Error(`configured provider API error ${response.status}: ${errorBody}`),
          'configured provider',
        );
      }

      const body = await response.json();
      return parseOpenAiResponse(body, 'configured provider');
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw classifyError(err, 'configured provider');
    }
  }

  throw new AiError(`Unknown AI provider: ${String(settings.provider)}`, 'unknown');
}
