'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore, type OnboardingData } from '@/store/onboardingStore';
import { useIntentStore } from '@/store/intentStore';
import { useApplicationStore } from '@/store/applicationStore';
import { useAuthStore } from '@/store/authStore';
import { createApplication } from '@/lib/api';
import ChatBubble from '@/components/onboarding/ChatBubble';
import ChatInputBar, { type InputType } from '@/components/onboarding/ChatInputBar';
import { Loader2, Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Separation of Concerns ───────────────────────────────────────────────────
// This page is the PRIMARY driver for onboarding data collection (steps 1-11).
// It collects: course, institution, year, score, income, loan amount, Aadhaar,
// PAN, bank account, and co-applicant details via structured UI input widgets.
//
// The AI Chat (/chat page, powered by ai_service/app/agents/conversation_agent.py)
// is a SEPARATE channel that also has a stage machine (INTENT → PROFILE_COLLECTION
// → KYC_GUIDANCE → BEHAVIORAL_ASSESSMENT → …). The AI chat is intended for users
// who prefer a conversational onboarding and for post-approval Q&A.
//
// RULE: Do NOT duplicate data collection between this wizard and the AI chat.
//   - Wizard → collects structured data → posts to /applications at step 11.
//   - AI chat → guides users who arrive via the chat widget, NOT via this wizard.
//   - After wizard submission at step 11 the app calls the AI service chat
//     endpoint (/chat/message) to sync the conversation state to KYC_GUIDANCE
//     stage so the AI can continue from there if the user switches to chat.
// ──────────────────────────────────────────────────────────────────────────────

// Configuration for the conversation flow
interface QuestionConfig {
  id: number;
  text: string;
  inputType: InputType;
  storeKey: keyof OnboardingData | 'summary';
}

const ONBOARDING_QUESTIONS: QuestionConfig[] = [
  { id: 1, text: "Welcome! Let's get started. What course are you planning to pursue?", inputType: "autocomplete", storeKey: "course" },
  { id: 2, text: "Great choice. At which institution?", inputType: "autocomplete", storeKey: "institution" },
  { id: 3, text: "What's the graduation year?", inputType: "number", storeKey: "year" },
  { id: 4, text: "What was your score in the last qualifying exam (%)?", inputType: "number", storeKey: "lastExamScore" },
  { id: 5, text: "What's your annual family income range?", inputType: "income_bands", storeKey: "familyIncome" },
  { id: 6, text: "How much loan do you require (in Lakhs)?", inputType: "slider", storeKey: "loanAmount" },
  { id: 7, text: "What's your Aadhaar number?", inputType: "aadhaar", storeKey: "aadhaar" },
  { id: 8, text: "Enter your PAN card number:", inputType: "pan", storeKey: "pan" },
  { id: 9, text: "Enter your bank account details (IFSC and Account Number):", inputType: "bank", storeKey: "bankAccount" },
  { id: 10, text: "Do you have a co-applicant for this loan?", inputType: "yes_no", storeKey: "coApplicant" },
  { id: 11, text: "Please review your details before we proceed.", inputType: "summary", storeKey: "summary" },
];

interface Message {
  id: string;
  sender: 'bot' | 'user';
  content: string | React.ReactNode;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { currentStep, data, setAnswer, nextStep } = useOnboardingStore();
  const { intent } = useIntentStore();
  const { applicationId, setApplicationId } = useApplicationStore();
  const { userId } = useAuthStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isTyping]);

  // Initial bot message and subsequent questions
  useEffect(() => {
    // Skip logic for Scholarship intent
    if (intent === 'scholarship') {
      if (currentStep === 6 || currentStep === 10) {
        nextStep();
        return;
      }
    }

    const question = ONBOARDING_QUESTIONS.find((q) => q.id === currentStep);
    
    if (!question) return;

    // Avoid duplicate bot messages for the same step if it's already there
    const lastBotMessage = [...messages].reverse().find(m => m.sender === 'bot');
    if (lastBotMessage && lastBotMessage.content === question.text) return;

    const timer = setTimeout(async () => {
      setIsTyping(true);
      
      // Simulate bot typing
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setIsTyping(false);

      if (question.storeKey === 'summary') {
          addBotMessage(
            <div className="space-y-3">
              <p>{question.text}</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm space-y-2 max-w-sm">
                <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-white/50">Course:</span> <span>{data.course}</span></div>
                <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-white/50">Inst:</span> <span>{data.institution}</span></div>
                <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-white/50">Grad Year:</span> <span>{data.year}</span></div>
                <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-white/50">Exam Score:</span> <span>{data.lastExamScore}%</span></div>
                <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-white/50">Loan Amt:</span> <span>₹{data.loanAmount} Lakh</span></div>
              </div>
            </div>
          );
      } else {
          addBotMessage(question.text);
      }
    }, messages.length === 0 ? 500 : 200);

    return () => clearTimeout(timer);
  }, [currentStep]);

  const addBotMessage = (content: string | React.ReactNode) => {
    const newMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      sender: 'bot',
      content,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleUserReply = async (value: any, displayLabel?: string) => {
    // 1. Add user message to UI
    const newUserMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      sender: 'user',
      content: displayLabel || (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // 2. Identify the current question
    const question = ONBOARDING_QUESTIONS.find((q) => q.id === currentStep);
    if (!question) return;

    // 3. Handle Special case: Summary Finalization
    if (question.storeKey === 'summary' && value === 'confirmed') {
        await handleFinalSubmission();
        return;
    }

    // 4. Save to store (if not 'summary')
    if (question.storeKey !== 'summary') {
      if (question.storeKey === 'coApplicant') {
        // Handle boolean reply for the coApplicant object field
        setAnswer('coApplicant', value === true ? { name: 'To be provided', income: 0 } : null);
      } else {
        setAnswer(question.storeKey as keyof OnboardingData, value);
      }
    }

    // 5. Advance step
    nextStep();
  };

  const handleFileUploadMessage = (message: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 11),
        sender: 'user' as const,
        content: message,
      },
    ]);
  };

  const handleFinalSubmission = async () => {
    setIsSubmitting(true);

    // Guard: if we already have an active application in the store, skip creation
    if (applicationId) {
      addBotMessage(
        "You already have an active application. Resuming your progress..."
      );
      // Mirror the app_id into sessionStorage for dashboard reads
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('app_id', applicationId);
      }
      setTimeout(() => router.push('/application/status'), 1500);
      return;
    }

    // UI Feedback
    addBotMessage(
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-indigo-400" size={18} />
        <span>Saving your details and preparing application...</span>
      </div>
    );

    try {
      const effectiveUserId =
        userId ||
        (typeof window !== 'undefined' ? sessionStorage.getItem('user_id') : null) ||
        '';

      const result = await createApplication({
        user_id: effectiveUserId,
        type: intent === 'scholarship' ? 'scholarship' : 'loan',
        loan_amount: typeof data.loanAmount === 'number' ? data.loanAmount * 100000 : 0,
      });

      const newAppId = result.app_id;
      setApplicationId(newAppId);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('app_id', newAppId);
      }

      addBotMessage("Excellent! Your application is ready. Redirecting to verification...");

      setTimeout(() => {
        router.push('/onboarding/kyc');
      }, 1500);
    } catch (error: unknown) {
      setIsSubmitting(false);

      // Handle 409 Conflict: user already has an active application
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const existingId = (error.response.data as { app_id?: string }).app_id;
        if (existingId) {
          setApplicationId(existingId);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('app_id', existingId);
          }
          addBotMessage(
            "You already have an active application. Resuming your progress..."
          );
          setTimeout(() => router.push('/application/status'), 1500);
        } else {
          addBotMessage("You already have an active application. Please check your dashboard.");
          setTimeout(() => router.push('/dashboard'), 1500);
        }
        return;
      }

      addBotMessage("Something went wrong. Please try again.");
    }
  };

  const currentQuestion = ONBOARDING_QUESTIONS.find((q) => q.id === currentStep);

  return (
    <main className="flex flex-col h-screen bg-[#070714] text-white font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-white/5 flex items-center px-6 justify-between bg-[#070714]/60 backdrop-blur-xl z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">AI Assistant</h1>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest border border-white/10 rounded-full px-3 py-1 bg-white/5">Step {currentStep} of {ONBOARDING_QUESTIONS.length}</span>
        </div>
      </header>

      {/* Message Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8 space-y-4 scrollbar-hide flex flex-col items-center"
      >
        <div className="w-full max-w-2xl space-y-2">
            {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
            ))}

            {isTyping && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl w-24 items-center justify-center h-12 shadow-inner"
                >
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                </motion.div>
            )}
        </div>
      </div>

      {/* Input Bar */}
      <footer className="shrink-0 z-30 pb-safe">
        <ChatInputBar
            inputType={currentQuestion?.inputType || 'text'}
            onReply={handleUserReply}
            isProcessing={isTyping || isSubmitting}
            onFileUpload={handleFileUploadMessage}
        />
      </footer>

      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[0%] right-[-5%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
      </div>
    </main>
  );
}
