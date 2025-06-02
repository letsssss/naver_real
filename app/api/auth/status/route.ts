// ✅ 인증 상태를 확인하는 API
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

export async function GET() {
  const supabase = createAdminClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 인증 상태 반환
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || '사용자',
    },
    session: {
      expires_at: new Date(session.expires_at! * 1000).toLocaleString(),
    }
  });
} 