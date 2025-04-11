import React from 'react';
import { Check } from "lucide-react"

interface StepProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  date?: string;
}

interface TransactionStepperProps {
  currentStep: string;
  steps: StepProps[];
}

export function TransactionStepper({ currentStep, steps }: TransactionStepperProps) {
  // 현재 단계의 인덱스 찾기
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  
  return (
    <div className="relative">
      <div className="flex justify-between items-start relative">
        {steps.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = step.id === currentStep;
          
          return (
            <div 
              key={step.id} 
              className={`flex flex-col items-center relative z-10 ${
                index === steps.length - 1 ? 'flex-grow-0' : 'flex-grow'
              }`}
            >
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
                } ${
                  isCurrent 
                    ? 'ring-4 ring-blue-100' 
                    : ''
                }`}
              >
                {step.icon}
              </div>
              
              <div className="mt-2 text-center">
                <p className={`text-sm font-medium ${isCompleted ? 'text-blue-600' : 'text-gray-500'}`}>
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-xs text-gray-500 mt-1">{step.date}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 연결선 */}
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-0">
        <div 
          className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300"
          style={{ 
            width: `${currentStepIndex === 0 
              ? 0 
              : currentStepIndex === steps.length - 1 
                ? '100%' 
                : `${(currentStepIndex / (steps.length - 1)) * 100}%`}`
          }}
        />
      </div>
    </div>
  );
}

