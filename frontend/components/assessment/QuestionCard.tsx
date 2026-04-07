'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Question } from '@/store/assessmentStore';
import { motion } from 'framer-motion';

interface QuestionCardProps {
  question: Question;
  onSubmit: (answer_text: string) => Promise<void>;
}

export function QuestionCard({ question, onSubmit }: QuestionCardProps) {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(answer);
      setAnswer('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      key={question.question_id}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl overflow-hidden relative"
    >
      {/* Background Gradient Detail */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[60px] rounded-full -ml-16 -mb-16" />

      <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
        <div className="space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            {question.question_text}
          </h2>
          <p className="text-gray-400 text-sm font-semibold tracking-wider uppercase">
            {question.type === 'mcq' ? 'Select an option' : 'Your Answer'}
          </p>
        </div>

        <div className="space-y-4">
          {question.type === 'mcq' ? (
            <div className="grid grid-cols-1 gap-4">
              {question.options?.map((option, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setAnswer(option)}
                  className={`group flex items-center p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                    answer === option
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50'
                      : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 mr-4 flex-shrink-0 flex items-center justify-center transition-colors ${
                    answer === option ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'
                  }`}>
                    {answer === option && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in-50 duration-300" />}
                  </div>
                  <span className={`text-lg font-semibold transition-colors ${
                    answer === option ? 'text-white' : 'text-gray-300 group-hover:text-white'
                  }`}>
                    {option}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <textarea
              placeholder="Your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full min-h-[200px] bg-white/5 border-2 border-white/5 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-white rounded-3xl p-6 text-xl transition-all resize-none outline-none placeholder:text-gray-600"
              spellCheck="false"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!answer.trim() || isSubmitting}
          className="w-full py-6 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl shadow-2xl shadow-indigo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Next Question</span>
          )}
        </button>
      </form>
    </motion.div>
  );
}
