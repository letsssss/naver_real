import { NextResponse } from 'next/server';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

// 단순 테스트용 함수
export async function POST() {
  console.log("✅ 런타임 체크 - 현재 시간:", new Date().toISOString());
  console.log("✅ process.env.SOLAPI_API_KEY:", process.env.SOLAPI_API_KEY);
  console.log("✅ process.env.SOLAPI_API_KEY 타입:", typeof process.env.SOLAPI_API_KEY);
  console.log("✅ process.env 키 확인:", Object.keys(process.env).filter(key => key.includes('SOLAPI')));
  
  // fallback 테스트
  const testApiKey = process.env.SOLAPI_API_KEY ?? "FALLBACK_API_KEY";
  console.log("✅ testApiKey:", testApiKey);
  console.log("✅ testApiKey 타입:", typeof testApiKey);
  
  return NextResponse.json({ status: 'OK', message: '테스트 완료' });
} 