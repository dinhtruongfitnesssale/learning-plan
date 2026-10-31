# Graph Report - learning-plan  (2026-10-31)

## Corpus Check
- 154 files · ~86,403 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .graphify-bak 1, .css 1)

## Summary
- 842 nodes · 2572 edges · 36 communities (24 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `55955ce9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- data.ts
- Auth Pages & Mailer
- payment-notify.ts
- khoa-hoc/[slug]/page.tsx
- react
- ui.tsx
- package.json
- Card
- hoc/xu/page.tsx
- Docs & Project Rules
- Coins Ledger Schema
- Lessons & Quiz Schema
- Payments Schema
- App Shell & Navigation
- hoc/xu/page.tsx
- TypeScript Config
- requireUser
- public
- Course Unlock & Discounts
- public
- Favicon
- App Icon
- Precision Coach Logo
- README Architecture Notes
- Vercel Crons
- PostCSS Config
- Course Categories

## God Nodes (most connected - your core abstractions)
1. `buttonClass()` - 95 edges
2. `createClient()` - 66 edges
3. `Card()` - 63 edges
4. `next` - 54 edges
5. `Eyebrow()` - 52 edges
6. `Badge()` - 48 edges
7. `guard()` - 47 edges
8. `react` - 41 edges
9. `requireCoach()` - 40 edges
10. `formatVnd()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `graphify skill (/graphify trigger)` --semantically_similar_to--> `graphify usage rules (query before grep, update after edits)`  [INFERRED] [semantically similar]
  .claude/CLAUDE.md → CLAUDE.md
- `graphify skill (/graphify trigger)` --conceptually_related_to--> `graphify-out knowledge graph`  [INFERRED]
  .claude/CLAUDE.md → CLAUDE.md
- `AutoConfirmSettings()` --indirect_call--> `updatePaymentSettings()`  [INFERRED]
  src/app/admin/thanh-toan/AutoConfirmSettings.tsx → src/app/admin/actions/payments.ts
- `savePromo()` --calls--> `nonNeg()`  [EXTRACTED]
  src/app/admin/actions/promos.ts → src/app/admin/actions/_shared.ts
- `deleteCategory()` --calls--> `guard()`  [EXTRACTED]
  src/app/admin/actions/courses.ts → src/app/admin/actions/_shared.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Gamification mechanics (Cornell-notes design)** — readme_progress_ring, readme_local_weekly_leaderboard, readme_variable_xp_reward, readme_streak_freeze, readme_competence_based_xp [EXTRACTED 1.00]
- **Project source structure** — readme_src_lib_brand, readme_src_lib_supabase, readme_src_lib_data, readme_src_app_hoc, readme_src_app_admin [EXTRACTED 1.00]
- **Server-side quiz grading flow** — readme_get_quiz_rpc, readme_submit_quiz_rpc, readme_hidden_quiz_answers, readme_competence_based_xp [INFERRED 0.85]

## Communities (36 total, 12 thin omitted)

### Community 0 - "data.ts"
Cohesion: 0.07
Nodes (78): deleteCategory(), AdminCourses(), CourseEditor(), AdminOverview(), AutoConfirmSettings(), Check(), dt(), PageParams (+70 more)

### Community 1 - "Auth Pages & Mailer"
Cohesion: 0.08
Nodes (41): nextConfig, next, ResetPasswordPage(), ResetForm(), beVietnam, jetbrains, metadata, sourceSerif (+33 more)

### Community 2 - "payment-notify.ts"
Cohesion: 0.07
Nodes (44): authorized(), GET(), BankTransfer, parsePayload(), POST(), secretMatches(), verifySecret(), me() (+36 more)

### Community 3 - "khoa-hoc/[slug]/page.tsx"
Cohesion: 0.09
Nodes (42): adjustCoins(), createCoinPack(), deleteCoinPack(), Msg, seedCoinPacks(), toggleCoinPack(), updateCoinPack(), updateCoinSettings() (+34 more)

### Community 4 - "react"
Cohesion: 0.08
Nodes (45): react, InviteGuestsState, inviteGuestsToCourse(), sendBroadcastEmail(), sendLearnerEmail(), approveEnrollment(), createLearner(), deleteLearner() (+37 more)

### Community 5 - "ui.tsx"
Cohesion: 0.08
Nodes (49): updateLesson(), addQuestion(), deleteQuestion(), deleteQuiz(), editQuestion(), importQuestions(), ImportState, quizBackPath() (+41 more)

### Community 6 - "package.json"
Cohesion: 0.05
Nodes (51): dependencies, next@16.2.9, nodemailer@^9.0.3, react@19.2.4, react-dom@19.2.4, react-markdown@^10.1.0, remark-gfm@^4.0.1, @supabase/ssr@^0.12.0 (+43 more)

### Community 7 - "Card"
Cohesion: 0.07
Nodes (45): assignCourse(), assignCourseToLearners(), remindInactiveNow(), setContentAssignments(), unassignCourse(), fmtDate(), ReviewsPage(), Stars() (+37 more)

### Community 8 - "hoc/xu/page.tsx"
Cohesion: 0.20
Nodes (16): CopyButton(), authed(), back(), claimCheckin(), startTopup(), unlockCourse(), unlockLesson(), CheckinButton() (+8 more)

### Community 9 - "Docs & Project Rules"
Cohesion: 0.08
Nodes (19): graphify skill (/graphify trigger), graphify-out knowledge graph, Bep Hoc LMS + Gamification, Coach (admin) features, get_quiz RPC, handle_new_user() trigger (auto-assign coach role), Brand 'mam com Viet' (paper + ink, 90/5/5 rule), supabase/migrations/0001_init.sql (tables, RLS, RPC, trigger) (+11 more)

### Community 10 - "Coins Ledger Schema"
Cohesion: 0.10
Nodes (26): public.is_coach(), public.profiles, public.is_guest(), coin_ledger_day_idx, coin_ledger_once_idx, coin_ledger_user_idx, profiles_referral_code, profiles_referral_code_idx (+18 more)

### Community 11 - "Lessons & Quiz Schema"
Cohesion: 0.12
Nodes (28): idx_lessons_course, idx_progress_user, idx_xp_course_date, idx_xp_user, on_auth_user_created, public.complete_lesson(), public.course_leaderboard(), public.enrollments (+20 more)

### Community 12 - "Payments Schema"
Cohesion: 0.16
Nodes (15): payment_events_result_idx, payments_one_open_idx, payments_status_idx, payments_user_idx, public.expire_stale_payments(), public.match_bank_transfer(), public.payment_events, public.payments (+7 more)

### Community 13 - "App Shell & Navigation"
Cohesion: 0.17
Nodes (22): AdminLayout(), LearnerLayout(), AppHeader(), Count(), Dropdown(), NavLink(), BottomNav(), Count() (+14 more)

### Community 14 - "hoc/xu/page.tsx"
Cohesion: 0.11
Nodes (22): ChangePasswordForm(), onSubmit(), ChangePassword(), LessonPage(), pdfEmbedSrc(), Field(), LoginForm(), onSubmit() (+14 more)

### Community 15 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 16 - "requireUser"
Cohesion: 0.10
Nodes (32): deletePromo(), Msg, savePromo(), togglePromo(), PromoAdmin(), PromoCourse, PromoForm(), toVnLocalInput() (+24 more)

### Community 18 - "public"
Cohesion: 0.17
Nodes (13): payment_promos_promo_idx, payment_promos_user_idx, public.apply_promo_code(), public._apply_promos(), public.create_payment_intent(), public._my_open_course_payment(), public.payment_course_price(), public.payment_promos (+5 more)

### Community 19 - "Course Unlock & Discounts"
Cohesion: 0.15
Nodes (7): public.courses, public.create_payment_intent(), public.unlock_course(), public.can_see_course(), public.lesson_accessible(), public.join_free_course(), public.create_payment_intent()

### Community 21 - "public"
Cohesion: 0.19
Nodes (12): public.streaks, idx_reviews_course, public.course_reviews, idx_lesson_asg_user, idx_module_asg_user, public.content_hidden(), public.lesson_assignments, public.module_assignments (+4 more)

### Community 22 - "Favicon"
Cohesion: 0.50
Nodes (4): Amber Bookmark / Book Spine, Bếp Học Favicon (open book logo mark), Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E), Open Book Icon (dark ink on cream background)

### Community 23 - "App Icon"
Cohesion: 0.67
Nodes (4): Bếp Học App Icon (icon.svg), Bếp Học Brand, Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E), Open Book Motif

### Community 24 - "Precision Coach Logo"
Cohesion: 0.67
Nodes (4): Brand Logo (balance-scale / bowl mark), Black Ink + Burnt Orange Accent Palette, Precision Balance Mark (vertical needle with orange dot over semicircular bowl), Trung Precision Coach Brand

### Community 26 - "README Architecture Notes"
Cohesion: 0.67
Nodes (3): Email + password login (magic link later), src/lib/data.ts (server-side data queries), src/lib/supabase/ (browser/server/admin clients + session proxy)

## Ambiguous Edges - Review These
- `Precision Balance Mark (vertical needle with orange dot over semicircular bowl)` → `Trung Precision Coach Brand`  [AMBIGUOUS]
  public/logo.png · relation: rationale_for

## Knowledge Gaps
- **13 isolated node(s):** `Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E)`, `Amber Bookmark / Book Spine`, `Open Book Icon (dark ink on cream background)`, `Open Book Motif`, `Black Ink + Burnt Orange Accent Palette` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 155 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Auth Pages & Mailer` to `data.ts`, `payment-notify.ts`, `khoa-hoc/[slug]/page.tsx`, `react`, `ui.tsx`, `package.json`, `Card`, `hoc/xu/page.tsx`, `App Shell & Navigation`, `hoc/xu/page.tsx`, `requireUser`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **What connects `Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E)`, `Amber Bookmark / Book Spine`, `Open Book Icon (dark ink on cream background)` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06501157163896487 - nodes in this community are weakly interconnected._
- **Why does `buttonClass()` connect `ui.tsx` to `data.ts`, `Auth Pages & Mailer`, `payment-notify.ts`, `khoa-hoc/[slug]/page.tsx`, `react`, `Card`, `hoc/xu/page.tsx`, `App Shell & Navigation`, `hoc/xu/page.tsx`, `requireUser`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `Auth Pages & Mailer` be split into smaller, more focused modules?**
  _Cohesion score 0.07662337662337662 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `data.ts`, `Auth Pages & Mailer`, `payment-notify.ts`, `khoa-hoc/[slug]/page.tsx`, `ui.tsx`, `package.json`, `Card`, `hoc/xu/page.tsx`, `App Shell & Navigation`, `hoc/xu/page.tsx`, `requireUser`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Precision Balance Mark (vertical needle with orange dot over semicircular bowl)` and `Trung Precision Coach Brand`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._