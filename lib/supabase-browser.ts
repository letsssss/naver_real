'use client';

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// 싱글톤 인스턴스로 브라우저 클라이언트 생성
const supabase = createBrowserSupabaseClient<Database>();

export default supabase; 