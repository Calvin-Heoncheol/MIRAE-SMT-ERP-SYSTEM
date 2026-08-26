# Supabase 셋업 · 보안

## 환경변수 (`.env.local`)

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon(공개) 키 — 클라이언트 허용 |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** service_role — 사용자등록 Admin API |
| `AUTH_ENABLED=true` | 로그인 강제 (운영·RLS 적용 후 필수) |

`SUPABASE_SERVICE_ROLE_KEY` 는 Dashboard → Project Settings → API → `service_role` 에서 복사합니다.  
**절대** `NEXT_PUBLIC_` 접두사로 넣거나 깃에 커밋하지 마세요.

## RLS 마이그레이션 (권장)

anon 키만으로 전 테이블 CRUD 되던 정책을 막습니다.

1. `setup-profiles.sql` (또는 `migrate-profiles-rls-fix.sql`) 적용
2. 앱에서 `AUTH_ENABLED=true` + 관리자 계정 로그인 확인
3. SQL Editor에서 **`migrate-rls-authenticated-writes.sql`** 실행
4. (P0 보강) **`migrate-rls-p0-harden.sql`** — 누락 테이블 harden + profiles role 잠금 트리거
5. (감사) **`migrate-entity-change-logs-auth-insert.sql`** — 변경이력 INSERT만 authenticated
6. (무결성) **`migrate-save-order-rpc.sql`** 후 **`migrate-orders-currency.sql`**(통화) · **`migrate-save-order-line-upsert.sql`**(라인 id 유지)
7. (무결성) **`migrate-atomic-quantity-inserts.sql`** — 생산·출하 동시 등록 레이스 방지
8. (P1) **`migrate-p1-inbound-fingerprint-po-lock.sql`** — 릴 fingerprint 유니크 + PO 입고 원자 RPC
9. (P1) **`migrate-p1-items-product-unique.sql`** — 반·조립 유니크(고객사+코드+버전)

적용 후:

- **조회(SELECT)**: 기존처럼 가능 (서버 RSC 호환)
- **등록/수정**: 로그인 사용자만
- **삭제**: 팀장(manager) 이상
- **기초등록**(품목·거래처·BOM): 관리자(admin)만
- **변경이력 INSERT**: 로그인만 (SELECT는 공개 유지)
- **profiles**: `trg_enforce_profile_safe_update` — 비관리자 본인의 role/department 변경 차단

`AUTH_ENABLED=false` 개발 모드에서는 JWT가 없어 쓰기가 막힐 수 있습니다. RLS 적용 환경에서는 로그인을 켜 주세요.

## 앱 레이어 가드

리포지토리 `assertCanWrite` 가 부서·역할(영업/자재/생산/기초등록)을 한 번 더 검사합니다.  
RLS는 DB 최종 방어선, `assertCanWrite` 는 UX·부서 범위용입니다.

### 메뉴·페이지 접근

- 사이드바: 대부분 메뉴를 보여 주되, 권한 없는 항목은「잠금」표시
- 클릭·URL 직접 접근: 미들웨어가 `/forbidden` 으로 보냄
- ERP 관리(기초등록·사용자): 관리자만 메뉴 표시
- 페이지 접근은 **부서** 기준, 삭제·직접재고는 **팀장 이상** 역할
