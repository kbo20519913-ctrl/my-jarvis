import { ChatPanel } from '../components/ChatPanel.tsx'

export function HomePage() {
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <h1 className="page-title">오늘의 시황</h1>
      <p className="mt-2 max-w-[60ch] text-[16px] leading-6 text-body">
        왼쪽 메뉴에서 세계, 한국, 주식·펀드, 코인을 고릅니다. 위쪽은 질문과 보유 종목에 맞춘 영상입니다.
      </p>
      <div className="mt-6 flex min-h-[28rem] flex-1 flex-col rounded-[16px] bg-white p-4 md:p-5">
        <ChatPanel domain="home" placeholder="예: 오늘 원달러와 코스피를 같이 보면?" />
      </div>
    </div>
  )
}
