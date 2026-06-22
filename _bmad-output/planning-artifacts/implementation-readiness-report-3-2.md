# Implementation Readiness Report — Story 3-2 (Lead-capture home empty-state)

> Sinh từ /story-ready (bmad-check-implementation-readiness, materialize 2026-06-18). Story: [3-2-home-lead-capture.md](../implementation-artifacts/3-2-home-lead-capture.md).

## Verdict: ✅ READY

| Tiêu chí | Trạng thái |
|---|---|
| AC cụ thể & testable (input→output + case lỗi) | ✅ 8 AC, mỗi cái có verify + error case |
| Grounded vào code (không đoán) | ✅ verify hạ tầng: /api/subscribe route, Subscriber model, submitWaitlistAction, WaitlistForm, page.tsx empty-branch — cite file:line |
| Scope rõ + cơ chế chốt | ✅ Subscriber chung (per-niche đã có lối coming-soon → không đụng) |
| Không cần backend mới | ✅ Subscriber/`/subscribers` + `/api/subscribe` route đã wired |
| Reuse xác minh | ✅ tách lõi từ subscribe-modal + mirror WaitlistForm (honeypot/useTransition) |
| Invariant bảo vệ | ✅ empty-vs-error (form chỉ nhánh empty) có guard S3 + giữ H3/H4 của 3-1 |
| Red test tồn tại | ✅ home-lead-capture-guards.mjs (4/4 ĐỎ) |
| Edge folded | ✅ E1 (không phá niche-picker modal), E2 (honeypot client-side) |

## Case list (duyệt "ok"): 17 — happy 3 · biên 4 · lỗi 4 · repo-risk 6
## Phụ thuộc: nền empty-state của story 3-1 (đã review). Không blocker.
