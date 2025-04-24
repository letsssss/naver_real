// ✅ 인증 상태를 확인하는 API
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase.types';

export async function GET() {
  const supabase = createRouteHandlerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 인증 상태 반환
  return NextResponse.json({
    authenticated: !!session,
    user: session ? {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || '사용자',
    } : null,
    session: session ? {
      expires_at: new Date(session.expires_at! * 1000).toLocaleString(),
    } : null,
  });
} 