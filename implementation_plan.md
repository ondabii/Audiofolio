# 📐 Implementation Plan: 트랙별 댓글 활성화/비활성화 토글 & 독립형 댓글 영역

- **작성일자**: 2026-10-11
- **목표**: 
  1. 트랙별로 댓글을 허용(ON)/차단(OFF)할 수 있는 활성화 토글 설정 구축
  2. 음원 트랙 없이도 카테고리 내에 독립적으로 배치 가능한 "순수 댓글 영역(댓글 전용 블록)" 생성/관리 기능 구현

---

## 1. 요구사항 및 아키텍처 명세

### A. 트랙별 댓글 활성화 / 비활성화 (Enable/Disable per Track)
- **동작**:
  - 기본적으로 모든 트랙에 댓글이 강제 활성화되는 것이 아니라, **트랙별로 댓글 허용 여부를 설정**.
  - **어드민 트랙 편집 페이지**에 `[다운로드 허용/차단]`처럼 **`[댓글 허용 / 차단]`** 토글 버튼 제공.
  - `is_comment_enabled === true` (1)로 활성화된 트랙에만 댓글 영역 노출.
  - 비활성화(차단)된 트랙에는 댓글 영역이 아예 나타나지 않음.
- **D1 스키마**:
  - `tracks` 테이블에 `is_comment_enabled INTEGER DEFAULT 0` 컬럼 추가.

### B. 독립형 댓글 영역 (트랙 없는 순수 댓글 블록)
- **개념**:
  - 오디오 음원(버전/플레이어) 없이 오직 **댓글/방명록 기능만을 수행하는 독립 블록**.
  - 카테고리 내에 자유롭게 배치 가능 (트랙들과 함께 위/아래 순서 변경 지원).
- **데이터 모델**:
  - `tracks` 테이블에 `track_type TEXT DEFAULT 'audio'` (`'audio'` | `'comment'`) 컬럼 추가.
  - `'comment'` 타입의 트랙은 음원 버전 없이 순수 댓글 컨테이너로 동작하며, `is_comment_enabled`는 항상 true.
- **어드민 관리**:
  - 카테고리 영역에 `[+ 트랙 추가]` 옆에 **`[+ 댓글 영역 추가]`** 버튼 배치.
  - 제목 인라인 수정(`InlineEditor`), 드래그 앤 드롭 순서 변경, 카테고리 이동, 블록 삭제를 기존 트랙과 100% 동일하게 지원.
- **화면 표시**:
  - 오디오 플레이어(스펙트럼)가 전혀 노출되지 않고,
  - 제목 + [이름, 댓글, 작성] 입력칸 + [작성 내역]으로만 깔끔하게 노출.

---

## 2. 세부 구현 계획

### Step 1: D1 데이터베이스 스키마 확장
```sql
ALTER TABLE tracks ADD COLUMN is_comment_enabled INTEGER DEFAULT 0;
ALTER TABLE tracks ADD COLUMN track_type TEXT DEFAULT 'audio';
```

### Step 2: 백엔드 API & Actions
- `toggleTrackCommentEnabled`: `UPDATE tracks SET is_comment_enabled = ? WHERE id = ?`
- `addCommentBlock`: `INSERT INTO tracks (id, category_id, title, track_type, is_comment_enabled, order_index) VALUES (?, ?, ?, 'comment', 1, ?)`

### Step 3: UI 컴포넌트 이식
- `AdminTrackDetail.tsx`:
  - 헤더 버튼 영역에 `[댓글 허용 / 차단]` 토글 버튼 추가.
- `TrackItem.tsx`:
  - `track.is_comment_enabled`가 참일 때만 `<TrackComments />` 렌더링.
  - `track.track_type === 'comment'`인 경우:
    - 오디오 플레이어(스펙트럼) 렌더링을 완전히 생략하고,
    - 제목 + 순수 댓글 입력칸 및 내역만 깔끔하게 렌더링.
- `AdminClientLayout.tsx`:
  - 카테고리 헤더에 `[+ 댓글 영역 추가]` 버튼 추가.

---

## 3. 검증 계획
- 프로토타입 확인: [standalone_comments_prototype.html](file:///c:/Users/ondabii/Documents/GitHub/Audiofolio/standalone_comments_prototype.html)
- 기능 동작:
  - 어드민에서 특정 트랙의 댓글을 허용/차단했을 때 공개 뷰에서 정상 반영되는지 확인.
  - `+ 댓글 영역 추가` 클릭 시 음원 플레이어 없는 순수 댓글 블록이 생성되고 순서 이동/삭제/수정 가능한지 확인.
- 빌드 검증: `npx next build` 프로덕션 컴파일 무결성 검증.
