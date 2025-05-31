import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/types/supabase.types";

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, '', ...options, maxAge: 0 });
        },
      },
    }
  );

  try {
    const payload = await request.json();
    console.log('결제 웹훅 페이로드:', payload);

    // 결제 상태 업데이트
    const { error: updateError } = await supabase
      .from('payments')
      .update({ status: payload.status })
      .eq('payment_id', payload.payment_id);

    if (updateError) {
      console.error('결제 상태 업데이트 실패:', updateError);
      return NextResponse.json({ error: '결제 상태 업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('웹훅 처리 중 오류:', error);
    return NextResponse.json({ error: '웹훅 처리 실패' }, { status: 500 });
  }
} 