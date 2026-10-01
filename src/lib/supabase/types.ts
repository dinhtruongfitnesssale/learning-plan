// Kiểu dữ liệu DB (khớp với supabase/migrations/0001_init.sql).
// Đủ dùng cho app; nếu đổi schema nhớ cập nhật ở đây.

export type Role = "learner" | "coach";
export type Accent = "amber" | "herb" | "slate" | "clay";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  created_at: string;
  /** Mốc nhận email tự soạn (kèm ảnh) gần nhất. NULL = chưa nhận lần nào. */
  last_custom_email_at: string | null;
  /** Tài khoản khách mời (được tặng khóa): không được tự yêu cầu học. */
  is_guest: boolean;
  /** Mã giới thiệu 6 ký tự, dùng trong link /dang-ky?ref=… */
  referral_code: string | null;
  /** Người đã mời học viên này (qua link giới thiệu). */
  referred_by: string | null;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  summary: string;
  cover_emoji: string;
  accent: Accent;
  category: string;
  sort_order: number;
  published: boolean;
  /** Học phí (VND, số nguyên). 0 = miễn phí → dùng luồng "Yêu cầu học". */
  price: number;
  /** Số bài đầu khóa học thử miễn phí, không cần ghi danh. */
  free_lessons: number;
  /** Xu để mở lẻ 1 bài. 0 = không bán lẻ. */
  lesson_coin_price: number;
  /** Xu để mở cả khóa. 0 = không bán cả khóa bằng xu. */
  course_coin_price: number;
  created_at: string;
}

export interface CourseCategory {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  accent: Accent;
  sort_order: number;
  created_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  /** Ngày mở chương (YYYY-MM-DD). NULL = mở ngay. */
  available_on: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  slug: string;
  summary: string;
  content: string;
  video_url: string;
  pdf_url: string;
  pdf_name: string;
  allow_download: boolean;
  est_minutes: number;
  xp_reward: number;
  sort_order: number;
  published: boolean;
  /** Ngày mở bài (YYYY-MM-DD). NULL = mở ngay. */
  available_on: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: "pending" | "approved";
  created_at: string;
}

export type PaymentStatus =
  | "pending"    // đã sinh mã, chờ tiền về
  | "matched"    // webhook khớp được mã — chờ coach xác nhận
  | "confirmed"  // coach đã chốt, khóa học đã mở
  | "rejected"
  | "expired";

export interface Payment {
  id: string;
  /** Mã ghi trong nội dung chuyển khoản, dạng BH + 8 ký tự hex. */
  code: string;
  user_id: string | null;
  course_id: string | null;
  /** Ảnh chụp lúc tạo đơn — sổ vẫn đọc được khi học viên/khóa bị xóa. */
  user_email: string;
  course_title: string;
  amount: number;
  status: PaymentStatus;
  bank_ref: string | null;
  /** Số tiền thực nhận. Lệch với amount = chuyển thừa, coach tự xử. */
  bank_amount: number | null;
  bank_content: string | null;
  matched_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  note: string;
  expires_at: string;
  created_at: string;
  /** Đơn NẠP XU: gói đã mua. null = đơn học phí khóa học. */
  pack_id: string | null;
  /** Số xu sẽ cộng khi chốt (> 0 nghĩa là đơn nạp xu). */
  coins: number;
}

// ── Xu ────────────────────────────────────────────────────────
export interface CoinSettings {
  id: number;
  /** Trần xu/ngày từ học bài + quiz. */
  daily_cap: number;
  reward_checkin: number;
  reward_lesson: number;
  reward_quiz: number;
  reward_module_quiz: number;
  reward_streak7: number;
  reward_review: number;
  referral_inviter: number;
  referral_invitee: number;
  /** Lượt thưởng người mời tối đa/tháng. 0 = không giới hạn. */
  referral_monthly_limit: number;
  signup_enabled: boolean;
  updated_at: string;
}

export interface CoinPack {
  id: string;
  name: string;
  /** VND */
  price: number;
  coins: number;
  bonus: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export type CoinKind =
  | "checkin"
  | "lesson"
  | "quiz"
  | "module_quiz"
  | "streak"
  | "review"
  | "referral_inviter"
  | "referral_invitee"
  | "topup"
  | "admin"
  | "unlock_lesson"
  | "unlock_course";

export interface CoinLedgerRow {
  id: string;
  user_id: string;
  amount: number;
  kind: CoinKind;
  ref_key: string | null;
  course_id: string | null;
  note: string;
  capped: boolean;
  earn_day: string;
  created_at: string;
}

export interface PaymentEvent {
  id: string;
  provider: string;
  provider_ref: string;
  amount: number;
  content: string;
  payload: Json;
  payment_id: string | null;
  /** matched | duplicate | no_code | unknown_code | expired | amount_short */
  result: string;
  created_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at: string;
}

// Phân công nội dung theo từng học viên (0013).
export interface ModuleAssignment {
  user_id: string;
  module_id: string;
  created_at: string;
}

export interface LessonAssignment {
  user_id: string;
  lesson_id: string;
  created_at: string;
}

export interface Quiz {
  id: string;
  lesson_id: string | null;
  module_id: string | null;
  title: string;
  pass_score: number;
  xp_reward: number;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  sort_order: number;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  created_at: string;
}

export interface XpEvent {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number;
  reason: string;
  ref_id: string | null;
  created_at: string;
}

export interface Streak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  freezes: number;
}

export interface CourseReview {
  id: string;
  user_id: string;
  course_id: string;
  r_content: number;
  r_coach: number;
  r_difficulty: number;
  r_applicability: number;
  r_overall: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

// Kết quả các RPC
export interface CompleteLessonResult {
  already: boolean;
  xp: number;
  bonus: number;
  streak?: number;
  /** Xu nhận được khi học xong bài (có thể 0 nếu đã chạm trần ngày). */
  coins?: number;
  /** Xu thưởng mốc chuỗi 7/14/21… ngày. */
  streak_coins?: number;
  cap_reached?: boolean;
}

export interface QuizPublic {
  id: string;
  title: string;
  pass_score: number;
  questions: { id: string; prompt: string; options: string[] }[];
}

export interface SubmitQuizResult {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  xp: number;
  bonus: number;
  results: {
    id: string;
    correct: boolean;
    correct_index: number;
    explanation: string;
  }[];
  /** true khi vừa fail đủ 2 lần → khóa học bị khóa. */
  locked: boolean;
  /** Số lượt fail còn lại trước khi bị khóa. */
  fails_left: number;
}

export interface LeaderboardRow {
  user_id: string;
  full_name: string;
  xp_week: number;
  rnk: number;
}

// Kiểu Database tối giản cho generic của supabase-js (đủ để không lỗi type).
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] };
      courses: { Row: Course; Insert: Partial<Course>; Update: Partial<Course>; Relationships: [] };
      modules: { Row: Module; Insert: Partial<Module>; Update: Partial<Module>; Relationships: [] };
      lessons: { Row: Lesson; Insert: Partial<Lesson>; Update: Partial<Lesson>; Relationships: [] };
      enrollments: { Row: Enrollment; Insert: Partial<Enrollment>; Update: Partial<Enrollment>; Relationships: [] };
      lesson_progress: { Row: LessonProgress; Insert: Partial<LessonProgress>; Update: Partial<LessonProgress>; Relationships: [] };
      module_assignments: { Row: ModuleAssignment; Insert: Partial<ModuleAssignment>; Update: Partial<ModuleAssignment>; Relationships: [] };
      lesson_assignments: { Row: LessonAssignment; Insert: Partial<LessonAssignment>; Update: Partial<LessonAssignment>; Relationships: [] };
      quizzes: { Row: Quiz; Insert: Partial<Quiz>; Update: Partial<Quiz>; Relationships: [] };
      quiz_questions: { Row: QuizQuestion; Insert: Partial<QuizQuestion>; Update: Partial<QuizQuestion>; Relationships: [] };
      quiz_attempts: { Row: QuizAttempt; Insert: Partial<QuizAttempt>; Update: Partial<QuizAttempt>; Relationships: [] };
      xp_events: { Row: XpEvent; Insert: Partial<XpEvent>; Update: Partial<XpEvent>; Relationships: [] };
      streaks: { Row: Streak; Insert: Partial<Streak>; Update: Partial<Streak>; Relationships: [] };
      course_reviews: { Row: CourseReview; Insert: Partial<CourseReview>; Update: Partial<CourseReview>; Relationships: [] };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment>; Relationships: [] };
      payment_events: { Row: PaymentEvent; Insert: Partial<PaymentEvent>; Update: Partial<PaymentEvent>; Relationships: [] };
      coin_settings: { Row: CoinSettings; Insert: Partial<CoinSettings>; Update: Partial<CoinSettings>; Relationships: [] };
      coin_packs: { Row: CoinPack; Insert: Partial<CoinPack>; Update: Partial<CoinPack>; Relationships: [] };
      coin_ledger: { Row: CoinLedgerRow; Insert: Partial<CoinLedgerRow>; Update: Partial<CoinLedgerRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      complete_lesson: {
        Args: { p_lesson_id: string };
        Returns: CompleteLessonResult;
      };
      get_quiz: {
        Args: { p_lesson_id: string };
        Returns: QuizPublic | null;
      };
      submit_quiz: {
        Args: { p_lesson_id: string; p_answers: Json };
        Returns: SubmitQuizResult;
      };
      course_leaderboard: {
        Args: { p_course_id: string };
        Returns: LeaderboardRow[];
      };
      create_payment_intent: {
        Args: { p_course_id: string };
        Returns: Payment;
      };
      match_bank_transfer: {
        Args: {
          p_provider: string;
          p_ref: string;
          p_amount: number;
          p_content: string;
          p_payload: Json;
        };
        Returns: { ok: boolean; result: string; code: string | null };
      };
      confirm_payment: {
        Args: { p_payment_id: string };
        Returns: {
          ok: boolean;
          already: boolean;
          /** course = mở khóa học · topup = cộng xu vào ví. */
          kind: "course" | "topup";
          user_id: string;
          course_id: string | null;
          coins: number;
        };
      };
      claim_daily_checkin: {
        Args: Record<string, never>;
        Returns: { coins: number; already: boolean };
      };
      unlock_lesson: {
        Args: { p_lesson_id: string };
        Returns: { already: boolean; spent?: number; balance: number };
      };
      unlock_course: {
        Args: { p_course_id: string };
        Returns: { already: boolean; spent?: number; balance?: number };
      };
      course_unlock_cost: {
        Args: { p_course_id: string };
        Returns: number;
      };
      create_topup_intent: {
        Args: { p_pack_id: string };
        Returns: Payment;
      };
      admin_adjust_coins: {
        Args: { p_user: string; p_amount: number; p_note?: string };
        Returns: number;
      };
      reject_payment: {
        Args: { p_payment_id: string; p_note?: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
