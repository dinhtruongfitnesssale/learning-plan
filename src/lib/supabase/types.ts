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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
