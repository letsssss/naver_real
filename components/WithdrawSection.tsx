import { WithdrawModal } from "@/components/withdraw-modal";

interface WithdrawSectionProps {
  balance: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function WithdrawSection({
  balance,
  isOpen,
  onOpenChange,
}: WithdrawSectionProps) {
  return (
    <WithdrawModal 
      isOpen={isOpen} 
      onClose={() => onOpenChange(false)} 
      balance={balance} 
    />
  );
} 