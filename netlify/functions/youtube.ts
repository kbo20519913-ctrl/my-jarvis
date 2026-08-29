import type { Config } from '@netlify/functions'
import { requireUser } from './_shared/auth.ts'
import { errorResponse, getEnv, googleCloudApiKey, json } from './_shared/env.ts'

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    await requireUser(req)
    const q = new URL(req.url).searchParams.get('q')?.trim()
    if (!q) return json({ videos: [] })

    const youtubeKey = getEnv('YOUTUBE_API_KEY')
    const key = youtubeKey?.startsWith('AIza') ? youtubeKey : googleCloudApiKey()
    if (!key) {
      return json({
        videos: [],
        error:
          '유튜브는 Google Cloud API 키(AIza로 시작)가 필요합니다. AI Studio 키(AQ.로 시작)는 이 API에 쓸 수 없습니다.',
      })
    }

    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('maxResults', '8')
    url.searchParams.set('q', q)
    url.searchParams.set('relevanceLanguage', 'ko')
    url.searchParams.set('safeSearch', 'moderate')
    url.searchParams.set('key', key)

    const res = await fetch(url)
    const data = (await res.json()) as {
      error?: { message?: string }
      items?: Array<{
        id?: { videoId?: string }
        snippet?: {
          title?: string
          channelTitle?: string
          thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
        }
      }>
    }
    if (!res.ok) {
      const raw = data.error?.message || '유튜브 검색 실패'
      const error = /API keys are not supported|Expected OAuth2/i.test(raw)
        ? '유튜브 Data API는 AI Studio 키를 받지 않습니다. Google Cloud Console에서 YouTube Data API v3를 켠 AIza 키를 YOUTUBE_API_KEY에 넣어 주세요.'
        : raw
      return json({ videos: [], error }, 502)
    }

    const videos = (data.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        id: item.id!.videoId as string,
        title: item.snippet?.title ?? '',
        channel: item.snippet?.channelTitle ?? '',
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.high?.url ||
          '',
        url: `https://www.youtube.com/watch?v=${item.id!.videoId}`,
      }))

    return json({ videos })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: '/api/youtube',
  method: 'GET',
}
