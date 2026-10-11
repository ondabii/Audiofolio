# 📐 Implementation Plan: 일반 연속재생 플레이어 & 미니멀 댓글 시스템

- **작성일자**: 2026-10-11
- **목표**: 
  1. Audiofolio 연속재생(플레이리스트) 모드 지원 (기존 AB 플레이어 디자인 100% 동일 유지, 트림X, 연속 자동재생, 불필요한 미사여구 텍스트 일체 배제)
  2. 트랙별 미니멀 댓글 시스템 구축 (입력칸과 작성 내역만 심플하게 표시, 안내 문구/이모지 배제, 단순 '작성자' 태그, 자동 링크, 어드민 전용 IP 확인 및 삭제)

---

## 1. 요구사항 및 정책

### A. 플레이어 (재생 방식만 분기, 시각 디자인 100% 동일)
- **디자인**: 기존 `TrackItem` 스펙트럼/파형/버튼 디자인을 그대로 유지 ('재생 대기', '완주됨' 등 추가 텍스트 일체 금지).
- **동작**:
  - `AB 비교 모드` (기본값): 동일 시간 동기화, 짧은 버전 자동 루프.
  - `연속 재생 모드 (플레이리스트)`: 트림 없이 원본 길이 완주 재생 후 다음 버전으로 자동 연속 재생.
- **설정**: 어드민 트랙 편집 화면에서 토글 지원 (`tracks.playback_mode` 컬럼 저장).

### B. 댓글 시스템 (군더더기 0개, 입력칸 + 내역 목록만 노출)
- **안내 문구/이모지 제거**:
  - "피드백 및 댓글", "댓글 작성하기", "자유롭게 피드백을 남겨주세요", "클린한 커뮤니티..." 등 미사여구 일체 제거.
  - 👑 왕관 이모지 제거 -> 어드민 작성 시 담백한 텍스트 **`[작성자]`** 태그만 부착.
- **입력 영역**:
  - `[이름] [내용] [작성]`
- **작성 내역**:
  - `[이름] [작성자 (어드민일 때만)] [작성시각] [IP (어드민 화면에서만)] [삭제 버튼 (어드민 화면에서만)]`
  - 본문: URL 감지 시 자동으로 `<a target="_blank">` 하이퍼링크 변환.

---

## 2. 아키텍처 및 구현 계획

### Step 1: D1 데이터베이스 스키마 확장
1. `comments` 테이블:
   ```sql
   CREATE TABLE IF NOT EXISTS comments (
     id TEXT PRIMARY KEY,
     track_id TEXT NOT NULL,
     author_name TEXT NOT NULL,
     content TEXT NOT NULL,
     is_admin INTEGER DEFAULT 0,
     ip_address TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
   );
   ```
2. `tracks` 테이블:
   ```sql
   ALTER TABLE tracks ADD COLUMN playback_mode TEXT DEFAULT 'ab_test';
   ```

### Step 2: 백엔드 API 라우트 (`/api/comments`)
- `GET /api/comments?track_id=...`
  - 댓글 목록 반환 (`ORDER BY created_at ASC`).
  - 일반 공개 뷰는 `ip_address` 제외, 어드민 호출(`?admin=true`) 시 원본 `ip_address` 포함.
- `POST /api/comments`
  - `track_id`, `author_name`, `content`, `is_admin`
  - Request Header(`cf-connecting-ip` || `x-forwarded-for`)에서 IP 추출하여 D1 저장.
- `DELETE /api/comments?id=...`
  - 어드민 전용 댓글 삭제.

### Step 3: `AudioEngine.tsx` 연속 재생 로직
- `playback_mode === 'playlist'` 설정 시:
  - 현재 버전 완주(`onended`) 시점에 다음 순번 버전을 찾아 `setPlayingVersionId(nextVersion.id)` 및 0초부터 자동 재생.

### Step 4: UI 컴포넌트 이식
- `src/components/audio/TrackComments.tsx`:
  - 미사여구 없이 [입력칸] + [작성 내역]만 렌더링.
  - URL 정규식 자동 하이퍼링크 파서 (`/(https?:\/\/[^\s]+)/g`).
  - 어드민 모드(`isAdmin={true}`)일 때만 IP 노출 및 [작성자] 플래그 전송.
- `src/components/audio/TrackItem.tsx` 하단에 `TrackComments` 마운트.
- `src/components/admin/AdminTrackDetail.tsx`:
  - 트랙 헤더에 `[재생 모드: AB 비교 / 연속 재생]` 설정 스위치 추가.

---

## 3. 검증 계획
- 프로토타입 확인: 불필요한 미사여구와 이모지가 전혀 없고 AB 플레이어 디자인과 미니멀 댓글이 올바르게 구성되었는지 점검.
- 기능 동작: 연속 재생 자동 전환, 자동 하이퍼링크, 어드민 전용 IP 표시 및 삭제 검증.
- 빌드 검증: `npx next build` 프로덕션 컴파일 무결성 검증.
