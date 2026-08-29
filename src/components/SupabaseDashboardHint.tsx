export function SupabaseDashboardHint() {
  return (
    <aside className="mt-8 rounded-[16px] bg-panel p-4 text-sm leading-relaxed text-body">
      <p className="font-semibold text-paper">Supabase 대시보드에서 removeChild 오류가 나면</p>
      <p className="mt-2">
        크롬이 영어 대시보드를 한글로 번역하면서 React DOM을 깨뜨린 것입니다. 시황실 코드 문제가 아닙니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5">
        <li>주소창 오른쪽 번역 아이콘을 누른 뒤 supabase.com은 번역하지 않음으로 둡니다.</li>
        <li>chrome://settings/languages 에서 페이지 번역 제안을 끕니다.</li>
        <li>확장 프로그램을 끈 시크릿 창에서 대시보드만 다시 엽니다.</li>
      </ol>
      <p className="mt-3">
        SQL 실행은 대시보드 대신 이 프로젝트의 마이그레이션 파일을 Cursor에서 적용할 수 있습니다.
      </p>
    </aside>
  )
}
