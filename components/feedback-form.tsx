"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"

export function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!feedback.trim()) {
      toast({
        title: "입력 오류",
        description: "피드백 내용을 입력해주세요.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedback: feedback.trim() }),
      })

      const data = await response.json()
      
      if (response.ok) {
        toast({
          title: "성공",
          description: "피드백이 성공적으로 제출되었습니다. 감사합니다!",
          variant: "default"
        })
        setFeedback("")
        setIsOpen(false)
      } else {
        toast({
          title: "오류",
          description: data.error || "피드백 제출에 실패했습니다.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="bg-white p-4 rounded-lg shadow-lg w-80">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">피드백</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                if (!isSubmitting) setIsOpen(false)
              }}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <form onSubmit={handleSubmit}>
            <Textarea
              placeholder="여러분의 의견을 들려주세요"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mb-2"
              required
              disabled={isSubmitting}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !feedback.trim()}
            >
              {isSubmitting ? "제출 중..." : "제출하기"}
            </Button>
          </form>
        </div>
      ) : (
        <Button 
          onClick={() => setIsOpen(true)} 
          className="bg-[#FFD600] hover:bg-[#FFE600] text-black px-6 py-2 rounded-xl"
        >
          피드백 주기
        </Button>
      )}
    </div>
  )
}

