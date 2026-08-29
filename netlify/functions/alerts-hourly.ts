import type { Config } from '@netlify/functions'
import { serviceClient } from './_shared/auth.ts'
import { geminiApiKey, getEnv, googleCloudApiKey, json } from './_shared/env.ts'
import { webSearch } from './_shared/search.ts'
import { FOREIGN_INVESTORS } from './_shared/investors.ts'

export default async () => {
  const url = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const service = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) {
    return json({ skipped: true, reason: 'service role missing' })
  }
  if (!googleCloudApiKey() && !geminiApiKey()) {
    return json({ skipped: true, reason: 'search keys missing' })
  }

  const supabase = serviceClient()
  const { data: holdings, error } = await supabase
    .from('holdings')
    .select('user_id, symbol, name, kind')
    .in('kind', ['stock', 'fund', 'coin'])

  if (error) return json({ error: error.message }, 500)

  const byUser = new Map<string, Array<{ symbol: string | null; name: string }>>()
  for (const row of holdings ?? []) {
    const list = byUser.get(row.user_id) ?? []
    list.push({ symbol: row.symbol, name: row.name })
    byUser.set(row.user_id, list)
  }

  let created = 0
  for (const [userId, items] of byUser) {
    for (const item of items) {
      const token = item.symbol || item.name
      if (!token) continue
      for (const investor of FOREIGN_INVESTORS) {
        const query = `${investor.name} ${token} Korea OR 한국 OR 주식 OR 코인`
        let sources
        try {
          sources = await webSearch(query, 3)
        } catch {
          continue
        }
        const hit = sources.find((s) => {
          const hay = `${s.title} ${s.snippet ?? ''}`.toLowerCase()
          return hay.includes(token.toLowerCase()) || hay.includes(item.name.toLowerCase())
        })
        if (!hit) continue

        const { data: existing } = await supabase
          .from('alerts')
          .select('id')
          .eq('user_id', userId)
          .eq('source_url', hit.url)
          .maybeSingle()
        if (existing) continue

        await supabase.from('alerts').insert({
          user_id: userId,
          title: `${investor.name} · ${item.name}`,
          body: hit.snippet || hit.title,
          source_url: hit.url,
          investor_name: investor.name,
          symbol: item.symbol,
        })
        created += 1
      }
    }
  }

  return json({ ok: true, created })
}

export const config: Config = {
  schedule: '@hourly',
}
