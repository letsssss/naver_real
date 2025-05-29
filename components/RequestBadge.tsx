import React from 'react';

interface RequestBadgeProps {
  className?: string;
}

export const RequestBadge: React.FC<RequestBadgeProps> = ({ className = "" }) => {
  return (
    <div 
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-pink-500 text-white hover:bg-pink-600 backdrop-blur-sm ${className}`}
    >
      구해요
    </div>
  );
};

export default RequestBadge; 