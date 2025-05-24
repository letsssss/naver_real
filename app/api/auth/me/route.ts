import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase.types';

export const runtime = 'nodejs';

// 사용자 정보 캐싱 (5분)
const userCache = new Map<string, { user: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

export async function GET() {
  const supabase = createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 사용자 정보 반환
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || '사용자',
      role: session.user.user_metadata?.role || 'USER',
      avatar_url: session.user.user_metadata?.avatar_url,
      created_at: session.user.created_at,
      last_sign_in_at: session.user.last_sign_in_at,
    },
    session: {
      access_token: session.access_token.substring(0, 10) + '...',
      expires_at: new Date(session.expires_at! * 1000).toLocaleString(),
    }
  });
}

// OPTIONS 메서드 처리 (CORS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 