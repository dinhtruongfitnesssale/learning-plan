# Graph Report - learning-plan  (2026-10-31)

## Corpus Check
- 159 files · ~89,500 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .graphify-bak 1, .css 1)

## Summary
- 863 nodes · 2651 edges · 43 communities (31 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cebe8c49`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- thanh-toan/page.tsx
- Auth Pages & Mailer
- requireCoach
- khoa-hoc/[slug]/page.tsx
- guard
- buttonClass
- package.json
- hoc/xu/page.tsx
- data.ts
- Docs & Project Rules
- Coins Ledger Schema
- Lessons & Quiz Schema
- Payments Schema
- App Shell & Navigation
- Eyebrow
- TypeScript Config
- requireUser
- theo-doi/page.tsx
- public
- Course Unlock & Discounts
- danh-gia/page.tsx
- 0013_content_assignments.sql
- Favicon
- App Icon
- Precision Coach Logo
- data.ts
- README Architecture Notes
- lesson-import.ts
- Vercel Crons
- PostCSS Config
- Course Categories
- createClient
- app/page.tsx
- public.course_reviews

## God Nodes (most connected - your core abstractions)
1. `buttonClass()` - 97 edges
2. `createClient()` - 68 edges
3. `Card()` - 63 edges
4. `next` - 54 edges
5. `Eyebrow()` - 52 edges
6. `guard()` - 48 edges
7. `Badge()` - 48 edges
8. `react` - 44 edges
9. `requireCoach()` - 42 edges
10. `formatVnd()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `graphify skill (/graphify trigger)` --semantically_similar_to--> `graphify usage rules (query before grep, update after edits)`  [INFERRED] [semantically similar]
  .claude/CLAUDE.md → CLAUDE.md
- `graphify skill (/graphify trigger)` --conceptually_related_to--> `graphify-out knowledge graph`  [INFERRED]
  .claude/CLAUDE.md → CLAUDE.md
- `GuiMailForm()` --indirect_call--> `sendBroadcastEmail()`  [INFERRED]
  src/app/admin/gui-mail/GuiMailForm.tsx → src/app/admin/actions/email.ts
- `confirmPayment()` --calls--> `guard()`  [EXTRACTED]
  src/app/admin/actions/payments.ts → src/app/admin/actions/_shared.ts
- `PaymentActions()` --indirect_call--> `confirmPayment()`  [INFERRED]
  src/app/admin/thanh-toan/PaymentActions.tsx → src/app/admin/actions/payments.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Gamification mechanics (Cornell-notes design)** — readme_progress_ring, readme_local_weekly_leaderboard, readme_variable_xp_reward, readme_streak_freeze, readme_competence_based_xp [EXTRACTED 1.00]
- **Project source structure** — readme_src_lib_brand, readme_src_lib_supabase, readme_src_lib_data, readme_src_app_hoc, readme_src_app_admin [EXTRACTED 1.00]
- **Server-side quiz grading flow** — readme_get_quiz_rpc, readme_submit_quiz_rpc, readme_hidden_quiz_answers, readme_competence_based_xp [INFERRED 0.85]

## Communities (43 total, 12 thin omitted)

### Community 0 - "thanh-toan/page.tsx"
Cohesion: 0.18
Nodes (18): confirmPayment(), rejectPayment(), updatePaymentSettings(), AutoConfirmSettings(), Check(), dt(), PageParams, PaymentCard() (+10 more)

### Community 1 - "Auth Pages & Mailer"
Cohesion: 0.08
Nodes (41): nextConfig, next, ResetPasswordPage(), ResetForm(), beVietnam, jetbrains, metadata, sourceSerif (+33 more)

### Community 2 - "requireCoach"
Cohesion: 0.05
Nodes (71): InviteGuestsState, inviteGuestsToCourse(), sendBroadcastEmail(), sendLearnerEmail(), createLearner(), deleteLearner(), LearnerState, resetLearnerPassword() (+63 more)

### Community 3 - "khoa-hoc/[slug]/page.tsx"
Cohesion: 0.09
Nodes (46): react, AdminCourses(), DiscountFields(), CourseEditor(), fmtDate(), toVnLocalInput(), PRESETS, PricingPresets() (+38 more)

### Community 4 - "guard"
Cohesion: 0.10
Nodes (39): adjustCoins(), createCoinPack(), deleteCoinPack(), Msg, seedCoinPacks(), toggleCoinPack(), updateCoinPack(), updateCoinSettings() (+31 more)

### Community 5 - "buttonClass"
Cohesion: 0.06
Nodes (63): updateLesson(), assignCourse(), assignCourseToLearners(), setContentAssignments(), unassignCourse(), addQuestion(), deleteQuestion(), deleteQuiz() (+55 more)

### Community 6 - "package.json"
Cohesion: 0.05
Nodes (51): dependencies, next@16.4.3, nodemailer@^10.3.1, react@19.2.4, react-dom@19.2.4, react-markdown@^10.1.0, remark-gfm@^4.0.1, @supabase/ssr@^0.12.0 (+43 more)

### Community 7 - "hoc/xu/page.tsx"
Cohesion: 0.22
Nodes (15): CopyButton(), authed(), back(), claimCheckin(), startTopup(), unlockCourse(), unlockLesson(), CheckinButton() (+7 more)

### Community 8 - "data.ts"
Cohesion: 0.10
Nodes (25): CourseFilters, DB, DEFAULT_COIN_SETTINGS, PAGE_SIZE, CoinLedgerRow, CoinPack, CoinSettings, CourseCategory (+17 more)

### Community 9 - "Docs & Project Rules"
Cohesion: 0.08
Nodes (19): graphify skill (/graphify trigger), graphify-out knowledge graph, Bep Hoc LMS + Gamification, Coach (admin) features, get_quiz RPC, handle_new_user() trigger (auto-assign coach role), Brand 'mam com Viet' (paper + ink, 90/5/5 rule), supabase/migrations/0001_init.sql (tables, RLS, RPC, trigger) (+11 more)

### Community 10 - "Coins Ledger Schema"
Cohesion: 0.10
Nodes (26): public.is_coach(), public.profiles, public.is_guest(), coin_ledger_day_idx, coin_ledger_once_idx, coin_ledger_user_idx, profiles_referral_code, profiles_referral_code_idx (+18 more)

### Community 11 - "Lessons & Quiz Schema"
Cohesion: 0.11
Nodes (29): idx_lessons_course, idx_progress_user, idx_xp_course_date, idx_xp_user, on_auth_user_created, public.complete_lesson(), public.course_leaderboard(), public.enrollments (+21 more)

### Community 12 - "Payments Schema"
Cohesion: 0.16
Nodes (15): payment_events_result_idx, payments_one_open_idx, payments_status_idx, payments_user_idx, public.expire_stale_payments(), public.match_bank_transfer(), public.payment_events, public.payments (+7 more)

### Community 13 - "App Shell & Navigation"
Cohesion: 0.27
Nodes (15): AdminLayout(), LearnerLayout(), AppHeader(), Count(), Dropdown(), NavLink(), BottomNav(), Count() (+7 more)

### Community 14 - "Eyebrow"
Cohesion: 0.09
Nodes (31): ChangePasswordForm(), onSubmit(), ChangePassword(), ModuleQuizPage(), LessonPage(), pdfEmbedSrc(), Field(), LoginForm() (+23 more)

### Community 15 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 16 - "requireUser"
Cohesion: 0.11
Nodes (29): deletePromo(), Msg, savePromo(), togglePromo(), PromoAdmin(), PromoCourse, PromoForm(), toVnLocalInput() (+21 more)

### Community 17 - "theo-doi/page.tsx"
Cohesion: 0.23
Nodes (13): remindInactiveNow(), AdminOverview(), AdminTracking(), formatDate(), lastActiveLabel(), LearnerRow(), ReminderFilter, RemindNowButton() (+5 more)

### Community 18 - "public"
Cohesion: 0.14
Nodes (16): public.push_log, public.push_subscriptions, push_subscriptions_user_idx, payment_promos_promo_idx, payment_promos_user_idx, public.apply_promo_code(), public._apply_promos(), public.create_payment_intent() (+8 more)

### Community 19 - "Course Unlock & Discounts"
Cohesion: 0.15
Nodes (7): public.courses, public.create_payment_intent(), public.unlock_course(), public.can_see_course(), public.lesson_accessible(), public.join_free_course(), public.create_payment_intent()

### Community 20 - "danh-gia/page.tsx"
Cohesion: 0.22
Nodes (13): fmtDate(), ReviewsPage(), Stars(), submitCourseReview(), CourseReview(), StarInput(), Stars(), getCourseReviews() (+5 more)

### Community 21 - "0013_content_assignments.sql"
Cohesion: 0.60
Nodes (5): idx_lesson_asg_user, idx_module_asg_user, public.content_hidden(), public.lesson_assignments, public.module_assignments

### Community 22 - "Favicon"
Cohesion: 0.50
Nodes (4): Amber Bookmark / Book Spine, Bếp Học Favicon (open book logo mark), Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E), Open Book Icon (dark ink on cream background)

### Community 23 - "App Icon"
Cohesion: 0.67
Nodes (4): Bếp Học App Icon (icon.svg), Bếp Học Brand, Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E), Open Book Motif

### Community 24 - "Precision Coach Logo"
Cohesion: 0.67
Nodes (4): Brand Logo (balance-scale / bowl mark), Black Ink + Burnt Orange Accent Palette, Precision Balance Mark (vertical needle with orange dot over semicircular bowl), Trung Precision Coach Brand

### Community 25 - "data.ts"
Cohesion: 0.44
Nodes (9): contentVisibility(), getCoinBalance(), getCourseDetail(), getLessonView(), getModuleQuizView(), lessonAccess(), moduleGating(), orderLessonsByModule() (+1 more)

### Community 26 - "README Architecture Notes"
Cohesion: 0.67
Nodes (3): Email + password login (magic link later), src/lib/data.ts (server-side data queries), src/lib/supabase/ (browser/server/admin clients + session proxy)

### Community 27 - "lesson-import.ts"
Cohesion: 0.31
Nodes (9): cell(), HEADERS, isUrl(), LessonExportRow, LessonParseResult, opt(), ParsedLessonRow, parseLessonWorkbook() (+1 more)

### Community 40 - "createClient"
Cohesion: 0.22
Nodes (12): GET(), POST(), isGuest(), requestEnroll(), requestRelearn(), startPayment(), getMyOpenPayment(), buildLessonWorkbook() (+4 more)

### Community 41 - "app/page.tsx"
Cohesion: 0.53
Nodes (5): Landing(), pillars, ButtonLink(), Rule(), getCurrentUser

### Community 42 - "public.course_reviews"
Cohesion: 0.67
Nodes (3): idx_reviews_course, public.course_reviews, course_reviews_coins

## Ambiguous Edges - Review These
- `Precision Balance Mark (vertical needle with orange dot over semicircular bowl)` → `Trung Precision Coach Brand`  [AMBIGUOUS]
  public/logo.png · relation: rationale_for

## Knowledge Gaps
- **13 isolated node(s):** `Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E)`, `Amber Bookmark / Book Spine`, `Open Book Icon (dark ink on cream background)`, `Open Book Motif`, `Black Ink + Burnt Orange Accent Palette` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Auth Pages & Mailer` to `thanh-toan/page.tsx`, `requireCoach`, `khoa-hoc/[slug]/page.tsx`, `guard`, `buttonClass`, `package.json`, `hoc/xu/page.tsx`, `createClient`, `app/page.tsx`, `data.ts`, `App Shell & Navigation`, `Eyebrow`, `requireUser`, `theo-doi/page.tsx`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `Brand Palette (paper #F6F2EA, ink #14110E, amber #B5651E)`, `Amber Bookmark / Book Spine`, `Open Book Icon (dark ink on cream background)` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Pages & Mailer` be split into smaller, more focused modules?**
  _Cohesion score 0.07662337662337662 - nodes in this community are weakly interconnected._
- **Why does `buttonClass()` connect `buttonClass` to `thanh-toan/page.tsx`, `Auth Pages & Mailer`, `requireCoach`, `khoa-hoc/[slug]/page.tsx`, `guard`, `hoc/xu/page.tsx`, `app/page.tsx`, `Eyebrow`, `requireUser`, `theo-doi/page.tsx`, `danh-gia/page.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `requireCoach` be split into smaller, more focused modules?**
  _Cohesion score 0.05284831846259437 - nodes in this community are weakly interconnected._
- **Why does `react` connect `khoa-hoc/[slug]/page.tsx` to `thanh-toan/page.tsx`, `Auth Pages & Mailer`, `requireCoach`, `guard`, `buttonClass`, `package.json`, `hoc/xu/page.tsx`, `createClient`, `App Shell & Navigation`, `Eyebrow`, `requireUser`, `theo-doi/page.tsx`, `danh-gia/page.tsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Precision Balance Mark (vertical needle with orange dot over semicircular bowl)` and `Trung Precision Coach Brand`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._