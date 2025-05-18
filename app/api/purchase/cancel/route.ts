import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  const { orderNumber, status, reason } = await req.json();

  if (!orderNumber || !status) {
    return NextResponse.json(
      { error: "orderNumber와 status는 필수입니다." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchases")
    .update({ status })
    .eq("order_number", orderNumber)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: data });
} 