# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

한국에서 세계·한국 경제, 주식·펀드, 코인을 근거와 함께 보려는 개인. 채팅으로 질문하고, 보유 종목·커뮤니티·알림을 같은 계정에서 이어서 쓴다. (이전 대화에서 확정, 이번 턴에서 재확인하지 않음.)

## Product Purpose

MY JARVIS는 웹 검색과 Claude로 시황을 정리하는 공개 웹앱이다. 미래 시세를 보장하지 않으며 투자 자문이 아니다. 성공은 출처가 달린 분석과, 가입 후 대화·자산이 유지되는 것이다.

## Positioning

검색 결과를 인용한 시나리오 분석. 매수·매도 지시가 아니라 강세·중립·약세와 근거 링크.

## Operating Context

Vite + React 로컬 개발, Supabase Auth/Postgres, Netlify Functions. 배포는 GitHub + Netlify.

## Capabilities and Constraints

채팅, 도메인 브리핑, 타이밍 차트, 보유 시세, 커뮤니티, 유튜브 추천, 해외 의견·알림. Claude는 Functions에서만. Google CSE·YouTube API. Admin은 Supabase `app_metadata.role`.

## Brand Commitments

- 제품명: MY JARVIS
- 보이스: 짧고 직접, 금융 은어를 풀어 씀. (토스 참고: Easy to answer, Value first)
- 시각: 사용자가 붙여 넣은 Toss TDS Mobile 토큰(프라이머리 `#3182f6`, Toss Product Sans는 라이선스상 재배포하지 않고 Pretendard 폴백). 토스 로고·워드마크는 쓰지 않음.
- 이전 KB 노랑 `#FFBC00` + 검정 셸은 폐기.

## Evidence on Hand

앱 카피, 기능, 라우트는 코드가 근거. 토스 폰트 원본은 없음.

## Product Principles

1. 선택은 비교 가능한 답으로 줄인다.
2. 이익·결과를 먼저 보이게 하고 그다음 입력을 받는다.
3. 중단된 흐름은 상태와 다음 행동을 밝힌다.
4. 분석에는 출처와 투자 고지를 붙인다.
5. 비밀 키는 브라우저에 넣지 않는다.
