import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export function PriceChart({
  candles,
  label,
  convention = 'intl',
  compact = false,
}: {
  candles: Array<{ t: number; c: number }>
  label: string
  convention?: 'intl' | 'kr'
  compact?: boolean
}) {
  if (!candles.length) {
    return <p className="text-sm text-mute">차트 데이터가 없습니다.</p>
  }
  const labels = candles.map((c) =>
    compact
      ? new Date(c.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : new Date(c.t).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
  )
  const first = candles[0].c
  const last = candles[candles.length - 1].c
  const up = last >= first
  const color = convention === 'kr' ? (up ? '#f04452' : '#3182f6') : up ? '#1f8a4c' : '#e42939'

  return (
    <div className={compact ? 'h-full' : 'h-64'}>
      <Line
        data={{
          labels,
          datasets: [
            {
              label,
              data: candles.map((c) => c.c),
              borderColor: color,
              backgroundColor: `${color}22`,
              fill: true,
              pointRadius: 0,
              borderWidth: 1.5,
              tension: 0.15,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              ticks: { color: '#8b95a1', maxTicksLimit: 8, font: { family: 'Pretendard Variable' } },
              grid: { color: '#e5e8eb' },
            },
            y: {
              ticks: { color: '#8b95a1', font: { family: 'Pretendard Variable' } },
              grid: { color: '#e5e8eb' },
            },
          },
        }}
      />
    </div>
  )
}
