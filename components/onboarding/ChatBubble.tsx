'use client';

import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatBubbleProps {
  message: {
    id: string;
    sender: 'bot' | 'user';
    content: string | React.ReactNode;
  };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isBot = message.sender === 'bot';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex w-full mb-6 items-start gap-3',
        isBot ? 'flex-row' : 'flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg',
          isBot ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
        )}
      >
        {isBot ? <Bot size={20} className="text-white" /> : <User size={20} className="text-white" />}
      </div>

      <div
        className={cn(
          'max-w-[80%] rounded-2xl p-4 shadow-xl backdrop-blur-md border border-gray-200 dark:border-white/10',
          isBot
            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white rounded-tl-none'
            : 'bg-indigo-600 text-white rounded-tr-none'
        )}
      >
        {typeof message.content === 'string' ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div>{message.content}</div>
        )}
      </div>
    </motion.div>
  );
}
