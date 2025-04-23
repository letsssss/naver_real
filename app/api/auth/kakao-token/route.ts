import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAccessToken, hashPassword, setSecureCookie } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { supabaseUserId, email } = await req.json();

    if (!supabaseUserId || !email) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // ✅ 1. Supabase에서 사용자 조회
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = row not found (이건 무시)
      console.error('사용자 조회 오류:', error);
      throw error;
    }

    // ✅ 2. 사용자가 없으면 생성
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await hashPassword(randomPassword);

      const { data: createdUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email,
            name: email.split('@')[0],
            password: hashedPassword,
            role: 'USER'
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('사용자 생성 오류:', insertError);
        throw insertError;
      }

      user = createdUser;
      console.log('소셜 로그인 사용자 생성됨:', user.id);
    } else {
      console.log('기존 사용자 확인됨:', user.id);
    }

    // ✅ 3. JWT 생성
    const token = generateAccessToken(user.id, user.email, user.role || 'USER');

    const response = NextResponse.json(
      { token, userId: user.id, success: true },
      { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
        }
      }
    );

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('카카오 토큰 변환 오류:', error);
    return NextResponse.json(
      { 
        error: '토큰 생성 중 오류가 발생했습니다.', 
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// OPTIONS 요청 처리 (CORS 프리플라이트 요청)
export async function OPTIONS(req: Request) {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
} 