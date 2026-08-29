import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function parseDotEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const text = raw.replace(/^\uFEFF/, '')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    let key = trimmed.slice(0, eq).trim()
    if (key.startsWith('export ')) key = key.slice(7).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

function collectEnvFiles(): string[] {
  const files: string[] = []
  const seen = new Set<string>()
  const starts: string[] = [process.cwd()]
  try {
    starts.push(dirname(fileURLToPath(import.meta.url)))
  } catch {
    /* bundled without import.meta.url */
  }

  for (const start of starts) {
    let dir = start
    for (let i = 0; i < 16; i++) {
      for (const name of ['.env.local', '.env']) {
        const path = join(dir, name)
        if (seen.has(path) || !existsSync(path)) continue
        seen.add(path)
        files.push(path)
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return files
}

function loadDotEnvFiles(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const path of collectEnvFiles()) {
    const parsed = parseDotEnv(readFileSync(path, 'utf8'))
    for (const [key, value] of Object.entries(parsed)) {
      if (out[key] === undefined) out[key] = value
    }
  }
  return out
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function isNetlifyCloud(): boolean {
  return process.env.NETLIFY === 'true' && process.env.NETLIFY_LOCAL !== 'true'
}

export function getEnv(name: string): string | undefined {
  const runtime = globalThis as {
    Netlify?: { env: { get: (key: string) => string | undefined } }
  }
  const fromNetlify = runtime.Netlify?.env.get(name)
  const fromProcess = process.env[name]
  const fromFile = loadDotEnvFiles()[name]

  // Production Functions get secrets from the Netlify UI. Locally the Vite plugin
  // does not inject .env into Netlify.env unless the site is linked, so prefer the file.
  if (isNetlifyCloud()) {
    return firstNonEmpty(fromNetlify, fromProcess, fromFile)
  }
  return firstNonEmpty(fromFile, fromProcess, fromNetlify)
}

export function requireEnv(name: string): string {
  const value = getEnv(name)
  if (!value) {
    throw new HttpError(500, `${name} 환경 변수가 없습니다.`)
  }
  return value
}

/** Custom Search / YouTube need a Cloud Console key (AIza...). AI Studio keys (AQ.) are rejected with OAuth errors. */
export function isCloudConsoleKey(value?: string): boolean {
  return Boolean(value?.trim().startsWith('AIza'))
}

export function googleCloudApiKey(): string | undefined {
  const google = getEnv('GOOGLE_API_KEY')
  const youtube = getEnv('YOUTUBE_API_KEY')
  if (isCloudConsoleKey(google)) return google?.trim()
  if (isCloudConsoleKey(youtube)) return youtube?.trim()
  return undefined
}

/** Custom Search must not reuse a YouTube-restricted key. */
export function customSearchApiKey(): string | undefined {
  const dedicated = getEnv('GOOGLE_CSE_API_KEY')
  const google = getEnv('GOOGLE_API_KEY')
  if (isCloudConsoleKey(dedicated)) return dedicated?.trim()
  if (isCloudConsoleKey(google)) return google?.trim()
  return undefined
}

export function geminiApiKey(): string | undefined {
  return firstNonEmpty(getEnv('GEMINI_API_KEY'), getEnv('GOOGLE_API_KEY'))
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status)
  }
  const message = error instanceof Error ? error.message : '서버 오류'
  return json({ error: message }, 500)
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, '잘못된 JSON 요청입니다.')
  }
}
