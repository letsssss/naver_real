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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLowerCase)) {
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "이메일 형식 오류");
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
    
    // Supabase 클라이언트 초기화
    const supabase = createAdminClient();
    
    // Supabase 클라이언트 검증
    if (!supabase || !supabase.auth) {
      console.error("Supabase 클라이언트 초기화되지 않음");
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "Supabase 클라이언트 초기화 실패");
      return NextResponse.json({ error: "내부 서버 오류가 발생했습니다." }, { status: 500 });
    }
    
    console.log("Supabase 정상 초기화 확인, auth.signUp 함수 유무:", !!supabase.auth.signUp);
    
    // 이메일 중복 검사
    try {
      // Supabase에서 사용자 이메일 검색
      const { data: existingUsers, error: getUsersError } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailLowerCase);
      
      if (getUsersError) {
        console.error("사용자 조회 오류:", getUsersError);
        await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "사용자 조회 오류");
        return NextResponse.json({ error: "사용자 조회 중 오류가 발생했습니다." }, { status: 500 });
      }
      
      if (existingUsers && existingUsers.length > 0) {
        await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "이메일 중복");
        return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
      }
    } catch (error) {
      console.error("이메일 중복 검사 오류:", error);
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "이메일 중복 검사 오류");
      return NextResponse.json({ error: "이메일 중복 검사 중 오류가 발생했습니다." }, { status: 500 });
    }
    
    // 1. Supabase Auth에 사용자 등록
    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailLowerCase,
        password,
        options: {
          data: {
            name,
            phone_number: phoneNumber,
            role: 'USER',
          }
        }
      });
      
      if (error) {
        console.error("Supabase Auth 등록 오류:", error);
        await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "Supabase Auth 등록 오류");
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      if (!data.user) {
        console.error("사용자 데이터 없음");
        await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "사용자 데이터 없음");
        return NextResponse.json({ error: "사용자 등록에 실패했습니다." }, { status: 500 });
      }
      
      // 2. Supabase public.users 테이블에 사용자 정보 저장
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: emailLowerCase,
          name,
          phone_number: phoneNumber,
          role: 'USER',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error("사용자 정보 저장 오류:", insertError);
        await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "사용자 정보 저장 오류");
        return NextResponse.json({ error: "사용자 정보 저장에 실패했습니다." }, { status: 500 });
      }
      
      // 성공 로그 기록
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "success");
      
      return NextResponse.json({
        success: true,
        message: "회원가입이 완료되었습니다. 이메일 인증을 진행해주세요.",
        user: {
          id: data.user.id,
          email: emailLowerCase,
          name,
          role: 'USER'
        }
      });
      
    } catch (error) {
      console.error("회원가입 처리 중 오류:", error);
      await logAuthEventWithRequest(request, "signup", emailLowerCase, "fail", "회원가입 처리 오류");
      return NextResponse.json({ error: "회원가입 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
    
  } catch (error) {
    console.error("회원가입 요청 처리 중 오류:", error);
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
} 