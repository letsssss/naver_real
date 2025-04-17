import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
// import { Database } from '@/types/supabase'; // 타입 없으면 주석 처리

// 싱글톤 인스턴스로 브라우저 클라이언트 생성
// 타입이 필요하면 createBrowserSupabaseClient<Database>() 형태로 수정
const supabase = createBrowserSupabaseClient();

export default supabase; 