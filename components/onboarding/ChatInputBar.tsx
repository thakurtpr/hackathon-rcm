'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, ChevronRight, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type InputType =
  | 'text'
  | 'autocomplete'
  | 'cards'
  | 'number'
  | 'income_bands'
  | 'slider'
  | 'aadhaar'
  | 'pan'
  | 'bank'
  | 'yes_no'
  | 'summary';

interface ChatInputBarProps {
  inputType: InputType;
  onReply: (data: any, displayLabel?: string) => void;
  isProcessing: boolean;
}

export default function ChatInputBar({ inputType, onReply, isProcessing }: ChatInputBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [extraValue, setExtraValue] = useState(''); // Used for bank account / extra fields

  const handleSend = () => {
    if (!inputValue && inputType !== 'bank' && inputType !== 'summary') return;
    
    if (inputType === 'bank') {
      onReply({ ifsc: inputValue, accountNumber: extraValue }, `IFSC: ${inputValue}, A/c: ${extraValue}`);
      setInputValue('');
      setExtraValue('');
    } else if (inputType === 'number' || inputType === 'slider') {
      onReply(Number(inputValue), inputValue);
      setInputValue('');
    } else {
      onReply(inputValue);
      setInputValue('');
    }
  };

  const renderInput = () => {
    switch (inputType) {
      case 'text':
      case 'autocomplete':
      case 'pan':
      case 'aadhaar':
        return (
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputType === 'pan' ? 'ABCDE1234F' : inputType === 'aadhaar' ? '1234 5678 9012' : "Type here..."}
              disabled={isProcessing}
              className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md transition-all shadow-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={isProcessing || !inputValue}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl px-4 py-3 flex items-center justify-center transition-all shadow-xl"
            >
              <Send size={20} />
            </button>
          </div>
        );

      case 'number':
        return (
          <div className="flex-1 flex gap-2">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter amount/year..."
              disabled={isProcessing}
              className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md transition-all shadow-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-3 flex items-center justify-center transition-all shadow-xl"
            >
              <Send size={20} />
            </button>
          </div>
        );

      case 'income_bands':
        const bands = ['< 5 LPA', '5-10 LPA', '10-20 LPA', '> 20 LPA'];
        return (
          <div className="flex flex-wrap gap-2 w-full justify-center">
            {bands.map((band) => (
              <button
                key={band}
                disabled={isProcessing}
                onClick={() => onReply(band)}
                className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-full px-6 py-2 transition-all hover:scale-105 active:scale-95 shadow-md backdrop-blur-sm"
              >
                {band}
              </button>
            ))}
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex gap-4 w-full justify-center">
            <button
              disabled={isProcessing}
              onClick={() => onReply(true, 'Yes')}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-white/10 rounded-xl px-8 py-3 transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center gap-2"
            >
              <CheckCircle size={18} /> Yes
            </button>
            <button
              disabled={isProcessing}
              onClick={() => onReply(false, 'No')}
              className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-xl px-8 py-3 transition-all hover:scale-105 active:scale-95 shadow-lg backdrop-blur-sm"
            >
              No
            </button>
          </div>
        );

      case 'slider':
        return (
          <div className="w-full flex flex-col gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl">
             <div className="flex justify-between items-center px-2">
                <span className="text-gray-500 dark:text-white/60 text-sm font-medium uppercase tracking-wider">Requested Range</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-300 dark:to-purple-300 bg-clip-text text-transparent transition-colors">₹ {inputValue || 1} Lakh</span>
             </div>
             <input
               type="range"
               min="1"
               max="50"
               step="1"
               disabled={isProcessing}
               value={inputValue || 1}
               onChange={(e) => setInputValue(e.target.value)}
               className="w-full accent-indigo-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
             />
             <button
               onClick={handleSend}
               disabled={isProcessing}
               className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-medium transition-all shadow-xl"
             >
               Confirm Amount <ChevronRight size={18} />
             </button>
          </div>
        );

      case 'bank':
        return (
          <div className="w-full flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Info size={16} className="text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs text-gray-500 dark:text-white/50 uppercase font-semibold">Bank Information Security Tier</p>
            </div>
            <input
              type="text"
              placeholder="IFSC Code"
              disabled={isProcessing}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md transition-colors"
            />
            <input
              type="text"
              placeholder="Account Number"
              disabled={isProcessing}
              value={extraValue}
              onChange={(e) => setExtraValue(e.target.value)}
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={isProcessing || !inputValue || !extraValue}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-3 flex items-center justify-center font-medium transition-all shadow-xl"
            >
              Verify & Save Account
            </button>
          </div>
        );

      case 'summary':
        return (
          <div className="w-full flex flex-col gap-3">
             <button
               onClick={() => onReply('confirmed', 'Everything looks correct!')}
               disabled={isProcessing}
               className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl py-4 flex items-center justify-center gap-2 font-bold transition-all shadow-2xl text-lg hover:scale-[1.02] active:scale-[0.98]"
             >
               <CheckCircle size={24} /> Submit Application
             </button>
             <p className="text-center text-gray-400 dark:text-white/40 text-xs px-4">
                By submitting, you agree to our terms of service and allow us to verify your provided information.
             </p>
          </div>
        );


      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex justify-center items-end bg-gradient-to-t from-white dark:from-[#0a0a1a] via-white/80 dark:via-[#0a0a1a]/80 to-transparent pt-12 transition-colors">
      <AnimatePresence mode="wait">
        <motion.div
           key={inputType}
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -30 }}
           transition={{ duration: 0.4, type: 'spring' }}
           className="w-full"
        >
          {renderInput()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
