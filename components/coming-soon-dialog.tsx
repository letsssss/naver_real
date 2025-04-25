"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ComingSoonDialogProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export function ComingSoonDialog({ isOpen, onClose, title = "서비스 오픈 예정" }: ComingSoonDialogProps) {
  const router = useRouter()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <p className="text-center text-gray-600">
            현재 준비 중인 서비스입니다.
            <br />
            더 나은 서비스로 곧 찾아뵙겠습니다.
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            메인으로 돌아가기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 