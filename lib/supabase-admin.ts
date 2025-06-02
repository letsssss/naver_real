import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';

// Admin 클라이언트 싱글톤
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

// Admin 클라이언트 생성 함수
export const createAdminClient = () => {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client cannot be used on the client side');
  }

  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Required environment variables are not set');
    }

    adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
};

// Admin 클라이언트 인스턴스 생성 및 내보내기
export const adminSupabase = createAdminClient(); 