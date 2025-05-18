"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Cart() {
  const [cartItems, setCartItems] = useState([])

  const removeItem = (id: number) => {
    setCartItems(cartItems.filter((item) => item.id !== id))
  }

  const total = cartItems.reduce((sum, item: any) => sum + item.price, 0)

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6 flex items-center">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>계속 쇼핑하기</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">장바구니</h1>

        {cartItems.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg shadow-md">
            <p className="text-gray-500 mb-4">장바구니가 비어있습니다.</p>
            <Link href="/tickets">
              <Button className="bg-[#0061FF] hover:bg-[#0052D6] text-white transition-colors">
                티켓 둘러보기
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cartItems.map((item: any) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md p-4 flex items-center">
                <Image
                  src={item.image || "/placeholder.svg"}
                  alt={item.title}
                  width={80}
                  height={80}
                  className="rounded-md mr-4"
                />
                <div className="flex-grow">
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                  <p className="text-gray-600">{item.artist}</p>
                  <p className="text-gray-600">{item.seat} 석</p>
                  <p className="text-gray-800 font-medium">{item.price.toLocaleString()}원</p>
                </div>
                <Button variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
            <div className="bg-white rounded-lg shadow-md p-4 mt-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">총 금액:</span>
                <span className="text-xl font-bold">{total.toLocaleString()}원</span>
              </div>
              <Button className="w-full bg-black hover:bg-gray-800 text-white transition-colors">결제하기</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

