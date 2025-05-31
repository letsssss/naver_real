import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase.types';

export const dynamic = 'force-dynamic' // 정적 경로 대신 동적 라우트 사용

export async function GET(request: Request) {
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', user.id);

    if (ticketsError) {
      return NextResponse.json({ error: '티켓 목록을 가져오는데 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(tickets);
  } catch (error) {
    console.error('티켓 목록 조회 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newTicket = await request.json()
    // 서버 사이드에서 Supabase 클라이언트 생성
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookies().set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookies().set({ name, '', ...options, maxAge: 0 });
          },
        },
      }
    );
    
    // 새로운 티켓 정보 삽입
    const { data, error } = await supabase
      .from("posts")
      .insert({
        title: newTicket.title,
        event_name: newTicket.artist,
        event_date: newTicket.date,
        ticket_price: newTicket.price,
        category: "콘서트",
        status: "판매중"
      })
      .select()
      .single()
      
    if (error) {
      console.error("티켓 생성 오류:", error)
      return NextResponse.json({ error: "티켓을 생성할 수 없습니다." }, { status: 500 })
    }
    
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("티켓 생성 API 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const updatedTicket = await request.json()
    // 서버 사이드에서 Supabase 클라이언트 생성
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookies().set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookies().set({ name, '', ...options, maxAge: 0 });
          },
        },
      }
    );
    
    // 티켓 정보 업데이트
    const { data, error } = await supabase
      .from("posts")
      .update({
        title: updatedTicket.title,
        event_name: updatedTicket.artist,
        event_date: updatedTicket.date,
        ticket_price: updatedTicket.price
      })
      .eq("id", updatedTicket.id)
      .select()
      .single()
      
    if (error) {
      console.error("티켓 업데이트 오류:", error)
      return NextResponse.json({ error: "티켓을 업데이트할 수 없습니다." }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("티켓 업데이트 API 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    // 서버 사이드에서 Supabase 클라이언트 생성
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookies().set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookies().set({ name, '', ...options, maxAge: 0 });
          },
        },
      }
    );
    
    // 티켓 삭제 (실제로는 상태 변경)
    const { error } = await supabase
      .from("posts")
      .update({ status: "삭제됨" })
      .eq("id", id)
      
    if (error) {
      console.error("티켓 삭제 오류:", error)
      return NextResponse.json({ error: "티켓을 삭제할 수 없습니다." }, { status: 500 })
    }
    
    return NextResponse.json({ message: "티켓이 성공적으로 삭제되었습니다." })
  } catch (error) {
    console.error("티켓 삭제 API 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

