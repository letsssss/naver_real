import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { generateUniqueOrderNumber } from "@/utils/orderNumber"


const orders = [
  { id: 1, userId: 1, ticketId: 1, quantity: 2, totalPrice: 220000, status: "pending" },
  { id: 2, userId: 2, ticketId: 2, quantity: 1, totalPrice: 99000, status: "completed" },
]

export async function GET() {
  return NextResponse.json(orders)
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // 주문 번호 생성
    const orderNumber = await generateUniqueOrderNumber()
    
    // Supabase를 사용하여 데이터베이스에 주문 생성
    const { data: newOrder, error } = await createAdminClient()
      .from("purchases")
      .insert({
        order_number: orderNumber,
        buyer_id: data.userId,
        seller_id: data.sellerId,
        post_id: data.postId,
        quantity: data.quantity || 1,
        total_price: data.totalPrice,
        status: data.status || "PENDING",
        payment_method: data.paymentMethod,
        selected_seats: data.selectedSeats,
        phone_number: data.phoneNumber,
        ticket_title: data.ticketTitle,
        event_date: data.eventDate,
        event_venue: data.eventVenue,
        ticket_price: data.ticketPrice || null,
        image_url: data.imageUrl,
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    // 임시 데이터베이스 업데이트 (API 예제 호환성 유지)
    const tempOrder = { ...data, id: orders.length + 1 }
    orders.push(tempOrder)
    
    return NextResponse.json({
      success: true,
      message: "주문이 성공적으로 생성되었습니다",
      order: {
        id: newOrder.id,
        orderNumber: newOrder.order_number,
        status: newOrder.status,
        totalPrice: newOrder.total_price?.toString(),
        ticketPrice: newOrder.ticket_price?.toString() ?? null,
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error("주문 생성 오류:", error)
    return NextResponse.json({ 
      success: false, 
      message: "주문 생성 중 오류가 발생했습니다",
      error: error.message || "Unknown error"
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const updatedOrder = await request.json()
  const index = orders.findIndex((o) => o.id === updatedOrder.id)
  if (index !== -1) {
    orders[index] = { ...orders[index], ...updatedOrder }
    return NextResponse.json(orders[index])
  }
  return NextResponse.json({ error: "Order not found" }, { status: 404 })
}

export async function DELETE(request: Request) {
  const { id } = await request.json()
  const index = orders.findIndex((o) => o.id === id)
  if (index !== -1) {
    orders.splice(index, 1)
    return NextResponse.json({ message: "Order deleted successfully" })
  }
  return NextResponse.json({ error: "Order not found" }, { status: 404 })
}

