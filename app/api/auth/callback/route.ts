import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase.types';

export async function POST(req: Request) {
  const requestUrl = new URL(req.url);
  const supabase = createRouteHandlerClient<Database>({ cookies });

  const { event, session } = await req.json();

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    // Supabase auth-helpers가 자동으로 쿠키 설정해줌
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }

  return NextResponse.redirect(requestUrl.origin);
} 