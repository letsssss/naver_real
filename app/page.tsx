"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { Toaster } from "sonner";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { fetchData } from "@/utils/api";

const popularTickets = [
  {
    id: 1,
    rank: 1,
    artist: "세븐틴",
    date: "25.03.20 ~ 25.03.21",
    venue: "잠실종합운동장 주경기장",
  },
  {
    id: 2,
    rank: 2,
    artist: "데이식스 (DAY6)",
    date: "25.02.01 ~ 25.03.30",
    venue: "전국투어",
  },
  {
    id: 3,
    rank: 3,
    artist: "아이브",
    date: "25.04.05 ~ 25.04.06",
    venue: "KSPO DOME",
  },
  {
    id: 4,
    rank: 4,
    artist: "웃는 남자",
    date: "25.01.09 ~ 25.03.09",
    venue: "예술의전당 오페라극장",
  },
];

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ticket-cancellation");
  }, [router]);

  // 리다이렉트 전 잠깐 보여줄 UI가 있으면 여기 작성 가능
  return null;
}
