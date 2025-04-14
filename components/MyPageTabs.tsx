import React from 'react';
import { User, ShoppingBag, Tag } from 'lucide-react';

interface MyPageTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function MyPageTabs({ activeTab, setActiveTab }: MyPageTabsProps) {
  return (
    <div className="flex border-b">
      <button
        className={`flex-1 py-4 px-6 text-center ${activeTab === "profile" ? "bg-gray-100 font-semibold" : ""}`}
        onClick={() => setActiveTab("profile")}
      >
        <User className="inline-block mr-2" />
        프로필
      </button>
      <button
        className={`flex-1 py-4 px-6 text-center ${activeTab === "ongoing-purchases" ? "bg-gray-100 font-semibold" : ""}`}
        onClick={() => setActiveTab("ongoing-purchases")}
      >
        <ShoppingBag className="inline-block mr-2" />
        진행중인 구매
      </button>
      <button
        className={`flex-1 py-4 px-6 text-center ${activeTab === "ongoing-sales" ? "bg-gray-100 font-semibold" : ""}`}
        onClick={() => setActiveTab("ongoing-sales")}
      >
        <Tag className="inline-block mr-2" />
        판매중인 상품
      </button>
    </div>
  );
} 