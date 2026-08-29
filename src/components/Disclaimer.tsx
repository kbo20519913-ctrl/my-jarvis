export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[12px] leading-relaxed text-mute ${className}`}>
      투자 자문이 아닙니다. 시세와 뉴스는 외부 출처에 의존하며, 미래 수익을 보장하지 않습니다.
      매수·매도 판단은 본인 책임입니다.
    </p>
  )
}
