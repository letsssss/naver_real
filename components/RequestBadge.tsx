import React from 'react';

interface RequestBadgeProps {
  className?: string;
}

export const RequestBadge: React.FC<RequestBadgeProps> = ({ className = "" }) => {
  // HEX 코드로 직접 색상 지정 (Tailwind 빌드 문제 해결)
  const badgeClassName = className || "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-[#ec4899] text-white hover:bg-[#db2777] backdrop-blur-sm";

  return (
    <div 
      className={badgeClassName}
      style={{ 
        backgroundColor: '#ec4899',
        border: '1px solid #ec4899',
        color: 'white'
      }}
    >
      구해요
    </div>
  );
};

export default RequestBadge; 