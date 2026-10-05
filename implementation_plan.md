# 📐 Implementation Plan: 개별 트랙 임베드(Embed) 플레이어 위젯 기능 구현

- **작성일자**: 2026-10-04
- **목표**: 외부 웹사이트(Notion, 개인 웹사이트, 블로그 등)에 `<iframe>`으로 삽입 가능한 단일 트랙 전용 임베드 플레이어 라우트 구축 및 어드민 내 임베드 코드 생성/복사 UI 구현

---

## 1. 요구사항 명세 및 정책
1. **오토플레이(Autoplay) 미적용**:
   - `autoplay` 속성 및 자동 재생 로직을 완전히 배제하고, 사용자가 직접 재생 버튼을 클릭했을 때만 재생 시작.
2. **사이트 플레이어 디자인 및 설정 100% 보존**:
   - 기존 사이트의 `TrackItem` 마크업, 스펙트럼 렌더링, 재생/Solo 버튼, 타임라인, 노멀라이즈 배지, 다운로드 가능 설정 등을 그대로 계승.
   - 외부 사이트 삽입 영역(iframe)의 가로폭에 맞춰 `width: 100%` 가변(Fluid Responsive)으로 자연스럽게 축소/확대.
   - 단일 트랙 뷰이므로 다른 트랙이나 헤더/사이드바 등 불필요한 레이아웃은 제거하고 컴팩트하게 구성.
3. **어드민 전용 임베드 코드 관리**:
   - 공개 보기 페이지(Guest View)에는 임베드 버튼을 노출하지 않음.
   - 어드민 트랙 편집 페이지(`AdminTrackDetail.tsx`)의 트랙 헤더 영역에 **`[< > 임베드 코드]`** 버튼을 추가하고, 클릭 시 복사 가능한 모달 또는 팝오버 제공.

---

## 2. 아키텍처 및 구현 계획

### Step 1: D1 백엔드 API — 단일 트랙 조회 엔드포인트
- **경로**: `GET /api/embed/track/[trackId]`
- **런타임**: `export const runtime = 'edge';`
- **로직**:
  - `track_id`로 D1 데이터베이스 쿼리 (`SELECT * FROM tracks WHERE id = ?`)
  - 소속 프로젝트 정보 조회 (`SELECT id, title, custom_alias, short_id FROM projects WHERE ...`)
  - 해당 트랙의 활성 버전들 조회 (`SELECT * FROM track_versions WHERE track_id = ? AND is_visible = 1 AND status = 'active'`)
  - 음원 CDN URL (`R2_PUBLIC_URL`) 결합하여 JSON 반환.

### Step 2: Next.js App Router 임베드 페이지
- **경로**: `src/app/embed/track/[trackId]/page.tsx`
- **런타임**: `export const runtime = 'edge'; export const dynamicParams = true;`
- **컴포넌트 구성**:
  - `EmbedTrackClient.tsx`:
    - 해당 트랙의 버전들만 등록하는 단일 트랙용 `AudioEngine` 마운트
    - 사이트의 `TrackItem` 컴포넌트 재사용 (또는 100% 일치하는 경량 버전)
    - 상단 트랙명 + 소속 프로젝트 링크 배지 ("From [Project Name]")
    - 볼륨 조절 및 바텀 플레이어 없이 해당 트랙 자체 내에서 완결 재생.

### Step 3: Iframe 허용 및 보안 헤더 설정
- Next.js 응답 헤더 및 Cloudflare Pages 배포 시 외부 사이트의 `<iframe>` 삽입이 차단되지 않도록 CSP 및 `X-Frame-Options` 확인/설정.

### Step 4: 어드민 페이지 임베드 코드 복사 UI 이식
- **파일**: `src/components/admin/AdminTrackDetail.tsx`
- **UI**:
  - 트랙 타이틀 헤더 우측에 `[< > 임베드]` 버튼 추가
  - 클릭 시 `EmbedCodeModal` 또는 복사 팝오버 표시
  - 코드 예시:
    ```html
    <iframe src="https://audiofolio.ondabii.com/embed/track/{trackId}" width="100%" height="160" frameborder="0"></iframe>
    ```
  - `[복사하기]` 버튼 클릭 시 클립보드 복사 알림 토스트 표시

---

## 3. 검증 계획
1. **디자인 검증**: `embed_prototype.html`을 브라우저에서 열어 다양한 가로폭(320px, 480px, 768px, 100% 등)에서 정상 렌더링 확인.
2. **동작 검증**:
   - 오토플레이 없이 첫 진입 시 정지 상태 확인.
   - 재생 / Solo 버튼 클릭 시 정상 오디오 스트리밍 및 파형 진행선 작동 확인.
   - 어드민에서 비공개(숨김) 처리한 버전이 임베드 뷰에서도 노출되지 않는지 확인.
   - 어드민 트랙 화면에서 원클릭 임베드 코드 복사 확인.
3. **빌드 검증**: `npx next build` 프로덕션 컴파일 및 Edge Runtime 통과 여부 검증.
