import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { createAdminClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// 사용자 정보 캐싱 (5분)
const userCache = new Map<string, { user: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

export async function GET() {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Session check error:', error);
      return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      console.error('User fetch error:', userError);
      return NextResponse.json({ error: 'Failed to get user data' }, { status: 500 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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