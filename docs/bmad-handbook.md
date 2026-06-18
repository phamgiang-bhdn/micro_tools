# BMAD — Sổ tay dùng trong dealvault

> Hướng dẫn dùng BMAD-METHOD v6 **đúng theo cấu hình đã cài trong repo này**, không phải lý thuyết chung. Source of truth: `_bmad/config.toml` + `_bmad/custom/*.toml` + `.claude/skills/story-ready/SKILL.md`.

## Cấu hình hiện tại (biết để khỏi ngạc nhiên)

- **Output** → `_bmad-output/` (planning + implementation + test artifacts).
- **Ngôn ngữ tài liệu**: tiếng Việt. Xưng hô "Giang", skill level `intermediate`.
- **Knowledge base**: `docs/` đã document đầy đủ (brownfield đã scan) — `architecture-api/web`, `data-models`, `project-context`.
- **3 override custom** (`_bmad/custom/`) ép mọi story/dev bám rule repo: mirror pattern có sẵn, giữ invariants, chạy `lint:web + test:api + build` trước khi báo done.
- Các module `gds` (game), `wds`, `cis` (creative) cài kèm nhưng **không liên quan** dealvault → bỏ qua.

## Chọn đường theo loại việc

| Loại việc | Dùng | Gõ gì |
|---|---|---|
| Sửa bug / thêm nhỏ / tweak | `bmad-quick-dev` | mô tả ý định trực tiếp |
| Feature thường | `bmad-create-story` → `bmad-dev-story` | "create story X" → "dev this story <path>" |
| Việc đụng invariant / rủi ro cao | `/story-ready X` → review → `bmad-dev-story` | "/story-ready <feature>" |
| Planning từ đầu (hiếm) | `bmad-prd` → `bmad-create-architecture` → `bmad-create-epics-and-stories` → `bmad-sprint-planning` | theo tên skill |

**Thực tế dealvault chỉ cần 2 đường:** `quick-dev` cho việc nhỏ, `/story-ready` cho việc đụng invariant. Phần planning đầu chu kỳ thường bỏ qua vì `docs/` đã đủ.

### "Rủi ro cao" = chạm bất kỳ thứ nào sau:
trackingCode round-trip · HITL gate (ProductExtraction/Article/Coupon — không auto-publish) · admin shared-secret auth · reconciler/money-trail · normalizeProduct · schemaConfig per-niche · sửa `schema.prisma`.

## `/story-ready` — chạy gì, theo thứ tự

1. `bmad-create-story` — draft story, ép AC thành `input → expected output` (gồm cả case lỗi).
2. `bmad-testarch-test-design` — liệt kê scenario: happy / biên / lỗi / repo-risk.
3. ⏸ **CHECKPOINT NGƯỜI** — bạn duyệt case list. *Đây là chốt chặn thật.* Trả lời "ok" để chạy tiếp.
4. `bmad-testarch-atdd` — viết test **đỏ** từ case đã duyệt.
5. `bmad-review-edge-case-hunter` — soi nhánh/biên còn sót, fold lại vào test.
6. `bmad-check-implementation-readiness` — gate; fail thì báo thiếu gì và dừng.
7. STOP → bàn giao. Bạn tự chạy `bmad-dev-story` sau.

**Không** chạy `bmad-advanced-elicitation` trong flow này. Phản biện được lo bằng edge-case-hunter (b5) + checkpoint người (b3). (Có thể create-story ở b1 tự bật elicitation — đó là hành vi sub-skill, không phải do story-ready chain vào.)

## Quy tắc vàng (custom override đã nhồi sẵn, nhưng nhớ để verify)

- **Mirror pattern trước khi viết mới.** Tìm cái tương đương gần nhất trong repo, copy đúng cấu trúc. Không tìm được mẫu → DỪNG, hỏi. Khi code phải nêu "theo pattern ở `<file:line>`".
- **Giữ invariants** (phá = hỏng doanh thu/brand): trackingCode 32-char round-trip · HITL gate không auto-publish · admin auth header `x-admin-role`+`x-admin-key` per-method · scrapedData chỉ qua `normalizeProduct` · schemaConfig per-niche động.
- **Sửa `schema.prisma`** → `npm run db:migrate -- --name <slug>`, không sửa DB tay.
- **Trước khi báo done**: `npm run lint:web` + `npm run test:api` + `npm run build`.
- Rule repo (CLAUDE.md / project-context.md) **thắng** convention generic của BMAD.

## Mẹo vận hành

- Story/artifact sinh ra nằm ở `_bmad-output/` — kiểm ở đó để xem BMAD đã tạo gì.
- Gọi agent theo tên cũng được: "talk to Amelia" (dev), "talk to Winston" (architect), "talk to John" (PM)... nhưng với dealvault thường không cần.
- Việc nhỏ đừng ép qua story-ready — thừa. Việc nguy hiểm đừng đi tắt quick-dev — thiếu.

## File liên quan

- Cấu hình: `_bmad/config.toml`, `_bmad/config.user.toml`
- Override team: `_bmad/custom/bmad-create-story.toml`, `bmad-dev-story.toml`, `bmad-quick-dev.toml`
- Skill chain: `.claude/skills/story-ready/SKILL.md`
- Rule repo: `docs/project-context.md`, `CLAUDE.md`, `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`
