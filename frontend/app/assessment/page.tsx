'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAssessmentStore } from '@/store/assessmentStore';
import { useApplicationStore } from '@/store/applicationStore';
import { useAuthStore } from '@/store/authStore';
import { getBehavioralQuestions, submitBehavioralAnswers } from '@/lib/api';
import { QuestionCard } from '@/components/assessment/QuestionCard';

export default function AssessmentPage() {
  const router = useRouter();

  const {
    questions,
    answers,
    currentQuestionIndex,
    status,
    setQuestions,
    addAnswer,
    nextQuestion,
    setStatus
  } = useAssessmentStore();

  const applicationId = useApplicationStore((s) => s.applicationId);
  const userId = useAuthStore((s) => s.userId);

  // Fetching Data
  useEffect(() => {
    const fetchData = async () => {
      if (questions.length === 0) {
        setStatus('loading');
        try {
          // Pass app_id and user_id so the AI service can personalise questions
          const appId = applicationId || undefined;
          const uid = userId || undefined;
          const data = await getBehavioralQuestions(appId, uid);
          setQuestions(data);
          setStatus('active');
        } catch (error) {
          console.error('Error fetching questions:', error);
          setStatus('idle');
        }
      }
    };
    fetchData();
  }, [questions.length, setQuestions, setStatus, applicationId, userId]);

  // 4. Submit Handler (Strict Logic)
  const handleAnswerSubmit = async (answerText: string) => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return;

    // Add answer to store
    addAnswer({ 
      question_id: currentQ.question_id, 
      answer_text: answerText 
    });

    // The Logic Gate
    if (currentQuestionIndex < questions.length - 1) {
      nextQuestion(); // Move to next
    } else {
      // It's the last question
      setStatus('submitting');
      // Use the store's current state to get all answers including the one just added
      const finalAnswers = useAssessmentStore.getState().answers;
      await submitBehavioralAnswers(finalAnswers);
      router.push('/application/status'); // Navigate to Live Status Tracker
    }
  };

  // 5. Safe Rendering
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {/* Loading states */}
      {(status === 'loading' || questions.length === 0) && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <div className="text-xl font-medium">Loading questions...</div>
        </div>
      )}

      {/* Submitting state */}
      {status === 'submitting' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin" />
          </div>
          <div className="text-2xl font-bold">AI is evaluating your responses...</div>
          <p className="text-gray-400">Please wait while we process your assessment.</p>
        </div>
      )}

      {/* Active state */}
      {status === 'active' && questions.length > 0 && (
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="text-indigo-400 font-bold tracking-widest uppercase text-sm">
              Behavioral Assessment
            </div>
            <h1 className="text-lg font-medium text-gray-400">
              Question {currentQuestionIndex + 1} of {questions.length}
            </h1>
          </div>
          
          <QuestionCard 
            question={questions[currentQuestionIndex]} 
            onSubmit={handleAnswerSubmit} 
          />
        </div>
      )}
    </div>
  );
}
