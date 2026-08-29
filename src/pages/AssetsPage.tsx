import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.tsx'
import { supabase } from '../lib/supabase.ts'
import { api, type Holding } from '../lib/types.ts'

type Quote = {
  symbol: string
  price: number | null
  changePct: number | null
  currency: string
  error?: string
}

export function AssetsPage() {
  const { session, user } = useAuth()
  const [rows, setRows] = useState<Holding[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<Holding['kind']>('stock')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [avgPrice, setAvgPrice] = useState('0')
  const [cash, setCash] = useState('0')

  async function load() {
    if (!user) return
    const { data, error: loadError } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    else setRows((data as Holding[]) ?? [])
  }

  useEffect(() => {
    void load()
  }, [user])

  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    const stocks = rows.filter((r) => r.kind === 'stock' || r.kind === 'fund').map((r) => r.symbol).filter(Boolean) as string[]
    const coins = rows.filter((r) => r.kind === 'coin').map((r) => r.symbol).filter(Boolean) as string[]
    if (!stocks.length && !coins.length) {
      setQuotes([])
      return
    }
    const qs = new URLSearchParams()
    if (stocks.length) qs.set('stocks', stocks.join(','))
    if (coins.length) qs.set('coins', coins.join(','))
    api<{ quotes: Quote[] }>(`/api/quotes?${qs.toString()}`, token)
      .then((res) => setQuotes(res.quotes))
      .catch((err: Error) => setError(err.message))
  }, [rows, session?.access_token])

  const quoteMap = useMemo(() => {
    const map = new Map<string, Quote>()
    for (const q of quotes) map.set(q.symbol, q)
    return map
  }, [quotes])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const { error: insertError } = await supabase.from('holdings').insert({
      user_id: user.id,
      kind,
      name: name.trim(),
      symbol: symbol.trim() || null,
      quantity: Number(quantity) || 0,
      avg_price: Number(avgPrice) || 0,
      cash_balance: Number(cash) || 0,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setName('')
    setSymbol('')
    await load()
  }

  async function remove(id: string) {
    await supabase.from('holdings').delete().eq('id', id)
    await load()
  }

  function valueOf(row: Holding) {
    if (row.kind === 'deposit' || row.kind === 'savings') return Number(row.cash_balance)
    const q = row.symbol ? quoteMap.get(row.symbol) : undefined
    if (q?.price != null) return Number(row.quantity) * q.price
    return Number(row.quantity) * Number(row.avg_price)
  }

  const total = rows.reduce((sum, row) => sum + valueOf(row), 0)

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="page-title">내 자산</h1>
      <p className="mt-2 text-[36px] font-bold leading-[54px] tracking-tight">{total.toLocaleString('ko-KR')}</p>
      <p className="mt-1 text-[12px] text-mute">평가액은 시세 API(주식 Yahoo, 코인 Upbit) 기준입니다. 예·적금은 입력 잔액입니다.</p>

      <form className="mt-6 grid gap-2 sm:grid-cols-6" onSubmit={(e) => void add(e)}>
        <select value={kind} onChange={(e) => setKind(e.target.value as Holding['kind'])} className="field-box">
          <option value="stock">주식</option>
          <option value="fund">펀드</option>
          <option value="coin">코인</option>
          <option value="deposit">예금</option>
          <option value="savings">적금</option>
        </select>
        <input required placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} className="field-box sm:col-span-2" />
        <input placeholder="코드" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="field-box" />
        {kind === 'deposit' || kind === 'savings' ? (
          <input placeholder="잔액" value={cash} onChange={(e) => setCash(e.target.value)} className="field-box" />
        ) : (
          <>
            <input placeholder="수량" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="field-box" />
            <input placeholder="평단" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} className="field-box" />
          </>
        )}
        <button type="submit" className="btn-fill btn-fill-lg">
          <Plus size={14} />
          추가
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-down">{error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-[16px] bg-white px-4">
        <table className="w-full text-left text-sm">
          <thead className="text-[12px] text-mute">
            <tr>
              <th className="py-2 font-normal">종류</th>
              <th className="py-2 font-normal">이름</th>
              <th className="py-2 font-normal">코드</th>
              <th className="py-2 font-normal">현재가</th>
              <th className="py-2 font-normal">등락</th>
              <th className="py-2 font-normal">평가</th>
              <th className="py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const q = row.symbol ? quoteMap.get(row.symbol) : undefined
              const chg = q?.changePct
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-3 text-mute">{kindLabel(row.kind)}</td>
                  <td>{row.name}</td>
                  <td className="font-mono text-[13px]">{row.symbol || '-'}</td>
                  <td className="font-mono">{q?.price != null ? q.price.toLocaleString('ko-KR') : row.kind === 'deposit' || row.kind === 'savings' ? '-' : '...'}</td>
                  <td className={chg != null && chg >= 0 ? 'font-mono text-up' : 'font-mono text-down'}>
                    {chg != null ? `${chg.toFixed(2)}%` : ''}
                  </td>
                  <td className="font-mono">{valueOf(row).toLocaleString('ko-KR')}</td>
                  <td>
                    <button type="button" onClick={() => void remove(row.id)} className="p-1 text-mute hover:text-down" aria-label="삭제">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="mt-6 text-sm text-mute">보유 종목과 예·적금을 추가해 주세요.</p> : null}
      </div>
    </div>
  )
}

function kindLabel(kind: Holding['kind']) {
  const map = { stock: '주식', fund: '펀드', coin: '코인', deposit: '예금', savings: '적금' }
  return map[kind]
}
