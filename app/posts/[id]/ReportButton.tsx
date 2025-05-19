"use client";

import { useState, useEffect } from "react";
import { reportPost, hasReportedPost } from "./report-utils";

interface ReportButtonProps {
  postId: number;
  className?: string;
  variant?: "icon" | "text" | "button";
}

/**
 * 게시물 신고 버튼 컴포넌트
 * 사용자가 게시물을 신고할 수 있는 UI를 제공합니다.
 */
export default function ReportButton({ 
  postId, 
  className = "", 
  variant = "text" 
}: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 이미 신고했는지 확인
  useEffect(() => {
    const checkReportStatus = async () => {
      try {
        setLoading(true);
        const reported = await hasReportedPost(postId);
        setAlreadyReported(reported);
      } catch (error) {
        console.error("신고 상태 확인 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    checkReportStatus();
  }, [postId]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("신고 사유를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await reportPost(postId, reason);
      alert("신고가 접수되었습니다. 검토 후 조치하겠습니다.");
      setIsOpen(false);
      setReason("");
      setAlreadyReported(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "신고 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로딩 중이면 아무것도 표시하지 않음
  if (loading) return null;

  // 버튼 스타일 및 텍스트 설정
  let buttonContent;
  if (variant === "icon") {
    buttonContent = <span className="text-red-500">🚨</span>;
  } else if (variant === "button") {
    buttonContent = (
      <button
        disabled={alreadyReported}
        className={`text-sm px-3 py-1 rounded ${
          alreadyReported 
            ? "bg-gray-200 text-gray-500" 
            : "bg-red-100 text-red-600 hover:bg-red-200"
        } ${className}`}
        onClick={() => !alreadyReported && setIsOpen(true)}
      >
        {alreadyReported ? "신고됨" : "🚨 신고"}
      </button>
    );
  } else {
    // 기본 텍스트 버튼
    buttonContent = (
      <button
        disabled={alreadyReported}
        className={`text-sm text-red-500 hover:text-red-700 ${className}`}
        onClick={() => !alreadyReported && setIsOpen(true)}
      >
        {alreadyReported ? "신고됨" : "🚨 신고하기"}
      </button>
    );
  }

  return (
    <>
      {buttonContent}

      {/* 신고 모달 */}
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">게시물 신고</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                부적절한 게시물을 신고해주세요. 운영팀 검토 후 조치하겠습니다.
              </p>
              <textarea
                className="w-full border rounded p-2 h-32 text-sm"
                placeholder="신고 사유를 자세히 설명해주세요&#10;&#10;ex) 선입금 유도, 직거래 유도"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">
                * 허위 신고 시 제재를 받을 수 있습니다.
              </div>
            </div>
            <div className="p-3 bg-gray-50 flex justify-end space-x-2">
              <button
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "처리 중..." : "신고하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 