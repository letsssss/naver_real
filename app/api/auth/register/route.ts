// 타입 정의 추가
interface MemoryUser {
  id: number;
  email: string;
  name: string;
  role: string;
  [key: string]: any;
}

// global 타입 정의
declare global {
  var memoryUsers: MemoryUser[] | undefined;
}

import { NextResponse } from "next/server";
import { createAdminClient } from '@/lib/supabase-admin';
import { logAuthEventWithRequest } from '@/lib/auth-logger';

// 이메일 유효성 검사 함수
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, phoneNumber } = body;
    
    // 이메일 소문자 변환
    const emailLowerCase = email.toLowerCase();
    
    // 필수 필드 검증
    if (!email || !password || !name) {
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "필수 필드 누락");
      return NextResponse.json({ error: "이메일, 비밀번호, 이름은 필수 입력 사항입니다." }, { status: 400 });
    }
    
    // 이메일 형식 검증
    if (!isValidEmail(emailLowerCase)) {
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "잘못된 이메일 형식");
      return NextResponse.json({ error: "유효하지 않은 이메일 형식입니다." }, { status: 400 });
    }
    
    // 비밀번호 길이 검증
    if (password.length < 6) {
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "비밀번호 길이 부족");
      return NextResponse.json({ error: "비밀번호는 최소 6자 이상이어야 합니다." }, { status: 400 });
    }
    
    // 이름 길이 검증
    if (name.length < 2) {
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "이름 길이 부족");
      return NextResponse.json({ error: "이름은 최소 2자 이상이어야 합니다." }, { status: 400 });
    }
    
    // 전화번호 형식 검증 (선택적)
    if (phoneNumber) {
      const phoneRegex = /^[0-9]{10,11}$/;
      if (!phoneRegex.test(phoneNumber.replace(/-/g, ''))) {
        await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "전화번호 형식 오류");
        return NextResponse.json({ error: "유효하지 않은 전화번호 형식입니다." }, { status: 400 });
      }
    }
    
    // Supabase Auth로 회원가입
    const { data: authData, error: authError } = await createAdminClient().auth.signUp({
      email: emailLowerCase,
      password: password,
      options: {
        data: {
          name: name,
          role: 'USER',
          phone_number: phoneNumber || null
        }
      }
    });

    if (authError) {
      console.error("Supabase 회원가입 오류:", authError);
      
      // 이미 가입된 이메일인 경우
      if (authError.message.includes('already registered')) {
        await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "이미 가입된 이메일");
        return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
      }
      
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", authError.message);
      return NextResponse.json({ error: "회원가입 중 오류가 발생했습니다." }, { status: 500 });
    }

    if (!authData.user) {
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "사용자 생성 실패");
      return NextResponse.json({ error: "사용자 생성에 실패했습니다." }, { status: 500 });
    }

    // 사용자 정보를 users 테이블에 저장
    const { error: userError } = await createAdminClient()
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: emailLowerCase,
          name: name,
          role: 'USER',
          phone_number: phoneNumber || null
        }
      ]);

    if (userError) {
      console.error("사용자 정보 저장 오류:", userError);
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "사용자 정보 저장 실패");
      
      // 사용자 정보 저장 실패 시 인증 데이터 삭제
      await createAdminClient().auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json({ error: "사용자 정보 저장에 실패했습니다." }, { status: 500 });
    }

    // 성공 로그 기록
    await logAuthEventWithRequest(request, "signup", emailLowerCase, "success");

    return NextResponse.json({
      success: true,
      message: "회원가입이 완료되었습니다. 이메일 인증을 진행해주세요.",
      user: {
        id: authData.user.id,
        email: emailLowerCase,
        name: name,
        role: 'USER'
      }
    });

  } catch (error) {
    console.error("회원가입 처리 중 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
} 