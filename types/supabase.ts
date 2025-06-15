/**
 * Supabase 데이터베이스 스키마에 맞는 타입 정의
 */

/**
 * 게시물 테이블 구조 (posts)
 */
export type Post = {
  id: number;
  title: string;
  content: string;
  category?: string;
  created_at: string;
  updated_at?: string | null;
  author_id: string;  // UUID 형식
  is_deleted?: boolean;
  view_count?: number;
  event_name?: string;
  event_date?: string;
  event_venue?: string;
  ticket_price?: number;
  contact_info?: string;
  status?: string;
}

/**
 * 사용자 테이블 구조 (users)
 */
export type User = {
  id: string;  // UUID
  email: string;
  name?: string;
  created_at: string;
  updated_at?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean;
}

/**
 * 댓글 테이블 구조 (comments)
 */
export type Comment = {
  id: number;
  content: string;
  created_at: string;
  updated_at?: string | null;
  post_id: number;
  user_id: string;  // UUID
}

/**
 * 좋아요 테이블 구조 (likes)
 */
export type Like = {
  id: number;
  created_at: string;
  post_id: number;
  user_id: string;  // UUID
}

/**
 * 피드백 테이블 구조 (feedback)
 */
export type Feedback = {
  id: number;
  content: string;
  created_at: string;
  updated_at?: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  admin_notes?: string;
}

/**
 * API 응답용 게시물 타입 (camelCase)
 */
export type PostResponse = {
  id: number;
  title: string;
  content: string;
  category?: string;
  createdAt: string;
  updatedAt?: string | null;
  authorId: string;
  isDeleted?: boolean;
  viewCount?: number;
  eventName?: string;
  eventDate?: string;
  eventVenue?: string;
  ticketPrice?: number;
  contactInfo?: string;
  status?: string;
  // 추가 관계 필드
  author?: {
    id: string;
    name?: string;
    email?: string;
  };
  comments?: {
    id: number;
    content: string;
    createdAt: string;
    userId: string;
  }[];
  likesCount?: number;
}

/**
 * 티켓 판매 게시물 전용 확장 필드
 */
export type TicketPostContent = {
  description: string;
  dates: Array<{ date: string }>;
  venue: string;
  time: string;
  sections: Array<{
    id: string;
    label: string;
    price: number;
    available: boolean;
  }>;
  additionalInfo?: string;
}

/**
 * 에러 응답 타입
 */
export type ErrorResponse = {
  error: string;
  code: string;
  status: number;
  timestamp: string;
  details?: any;
  userMessage?: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          profile_image?: string;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          profile_image?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          profile_image?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      feedback: {
        Row: {
          id: number;
          content: string;
          created_at: string;
          updated_at?: string;
          status: 'pending' | 'reviewed' | 'resolved';
          admin_notes?: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          updated_at?: string;
          status?: 'pending' | 'reviewed' | 'resolved';
          admin_notes?: string;
        };
        Update: {
          content?: string;
          updated_at?: string;
          status?: 'pending' | 'reviewed' | 'resolved';
          admin_notes?: string;
        };
      };
      chats: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          message: string;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          message: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          message?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
} 