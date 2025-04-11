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
  const getCurrentStepIndex = () => {
    return steps.findIndex((step) => step.id === currentStep);
  }

  const isStepCompleted = (stepIndex: number) => {
    const currentStepIndex = getCurrentStepIndex();
    return stepIndex < currentStepIndex;
  }

  const isCurrentStep = (stepId: string) => {
    return stepId === currentStep;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* 스텝 아이콘 */}
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                  isCurrentStep(step.id)
                    ? "border-blue-500 bg-blue-50 text-blue-600"
                    : isStepCompleted(index)
                    ? "border-green-500 bg-green-50 text-green-600"
                    : "border-gray-200 bg-gray-50 text-gray-400"
                }`}
              >
                {step.icon}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={`text-sm font-medium ${
                    isCurrentStep(step.id) 
                      ? "text-blue-600" 
                      : isStepCompleted(index)
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-xs text-gray-400 mt-1">{step.date}</p>
                )}
              </div>
            </div>

            {/* 스텝 사이 연결선 */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  isStepCompleted(index + 1) ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

