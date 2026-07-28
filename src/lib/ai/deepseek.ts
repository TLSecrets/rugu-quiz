export interface DeepseekConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DeepseekUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export interface DeepseekChatResult {
  content: string
  usage?: DeepseekUsage
  model?: string
}

function resolveChatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '') || 'https://api.deepseek.com'
  if (/\/chat\/completions$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`
  return `${base}/chat/completions`
}

export class DeepseekError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'DeepseekError'
    this.status = status
  }
}

/**
 * 浏览器直连 DeepSeek OpenAI 兼容接口。
 * Key 仅用于本次请求 Authorization，不会发往其他服务器。
 */
export async function chatCompletions(
  config: DeepseekConfig,
  messages: ChatMessage[],
  options?: { temperature?: number; signal?: AbortSignal },
): Promise<DeepseekChatResult> {
  const key = config.apiKey.trim()
  if (!key) {
    throw new DeepseekError('未配置 API Key，请先在设置中填写 DeepSeek Key')
  }

  const url = resolveChatCompletionsUrl(config.baseUrl)

  async function request(withJsonFormat: boolean): Promise<DeepseekChatResult> {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: options?.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: config.model.trim() || 'deepseek-chat',
          messages,
          temperature: options?.temperature ?? 0.2,
          stream: false,
          ...(withJsonFormat ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new DeepseekError('已取消请求')
      }
      const hint =
        e instanceof TypeError
          ? '网络失败或浏览器跨域（CORS）拦截。请确认 Key/地址正确；若持续被拦截，需在本机代理或扩展放行（本应用不经第三方中转）。'
          : e instanceof Error
            ? e.message
            : '请求失败'
      throw new DeepseekError(hint)
    }

    const rawText = await response.text()
    let data: {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
      usage?: DeepseekUsage
      model?: string
    } = {}
    try {
      data = rawText ? (JSON.parse(rawText) as typeof data) : {}
    } catch {
      /* ignore */
    }

    if (!response.ok) {
      const msg = data.error?.message || rawText.slice(0, 240) || `HTTP ${response.status}`
      throw new DeepseekError(msg, response.status)
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new DeepseekError('模型未返回有效内容')
    }

    return {
      content,
      usage: data.usage,
      model: data.model,
    }
  }

  try {
    return await request(true)
  } catch (e) {
    // 部分兼容网关不支持 response_format，回退再试一次
    if (e instanceof DeepseekError && e.status && e.status >= 400 && e.status < 500) {
      return await request(false)
    }
    throw e
  }
}
