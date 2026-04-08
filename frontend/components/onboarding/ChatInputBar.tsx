'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, ChevronRight, Info, Paperclip, Camera, X, FileText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { uploadDocument } from '@/lib/api';
import { WebcamCapture } from '@/components/kyc/WebcamCapture';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function detectDocType(filename: string): string {
  const name = filename.toLowerCase();
  if (name.includes('aadhaar') || name.includes('adhar')) return 'aadhaar';
  if (name.includes('pan')) return 'pan';
  if (name.includes('marksheet') || name.includes('result') || name.includes('certificate') || name.includes('grade') || name.includes('transcript')) return 'marksheet';
  if (name.includes('income') || name.includes('salary') || name.includes('itr') || name.includes('form16')) return 'income_cert';
  if (name.includes('passbook') || name.includes('bank') || name.includes('account')) return 'bank_passbook';
  if (name.includes('caste') || name.includes('category')) return 'caste_cert';
  return 'marksheet';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  onReply: (data: unknown, displayLabel?: string) => void;
  isProcessing: boolean;
  onFileUpload?: (message: string) => void;
}

export default function ChatInputBar({ inputType, onReply, isProcessing, onFileUpload }: ChatInputBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSend = async () => {
    // Handle file upload first if attached
    if (attachedFile && onFileUpload) {
      setIsUploading(true);
      setUploadError(null);
      const docType = detectDocType(attachedFile.name);
      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') ?? undefined : undefined;
      try {
        await uploadDocument(docType, attachedFile, userId);
        const msg = `I have uploaded ${attachedFile.name}`;
        removeAttachment();
        onFileUpload(msg);
      } catch {
        setUploadError('Upload failed. Please try again.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setSizeError('File too large. Maximum 10 MB.');
      return;
    }
    setSizeError(null);
    setUploadError(null);
    setAttachedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
    e.target.value = '';
  };

  const removeAttachment = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachedFile(null);
    setPreviewUrl(null);
    setSizeError(null);
    setUploadError(null);
  };

  const handleWebcamCapture = async (file: File) => {
    setIsWebcamOpen(false);
    if (!onFileUpload) return;
    setIsUploading(true);
    setUploadError(null);
    const userId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') ?? undefined : undefined;
    try {
      await uploadDocument('selfie', file, userId);
      onFileUpload(`I have uploaded ${file.name}`);
    } catch {
      setUploadError('Selfie upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Show attachment controls only for text-based inputs
  const showAttachment = ['text', 'autocomplete', 'pan', 'aadhaar'].includes(inputType);

  const renderInput = () => {
    switch (inputType) {
      case 'text':
      case 'autocomplete':
      case 'pan':
      case 'aadhaar':
        return (
          <div className="w-full flex flex-col gap-2">
            {/* File preview */}
            {attachedFile && (
              <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{attachedFile.name}</p>
                  <p className="text-[10px] text-white/40">{formatFileSize(attachedFile.size)}</p>
                </div>
                <button onClick={removeAttachment} className="text-white/40 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {(sizeError || uploadError) && (
              <p className="text-xs text-rose-400 px-1">{sizeError || uploadError}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  inputType === 'pan' ? 'ABCDE1234F' :
                  inputType === 'aadhaar' ? '1234 5678 9012' :
                  "Type here..."
                }
                disabled={isProcessing || isUploading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md transition-all shadow-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              {showAttachment && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => setIsWebcamOpen(true)}
                    disabled={isProcessing || isUploading}
                    title="Capture selfie"
                    className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl px-3 py-3 flex items-center justify-center transition-all"
                  >
                    <Camera size={18} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || isUploading}
                    title="Attach file"
                    className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl px-3 py-3 flex items-center justify-center transition-all"
                  >
                    <Paperclip size={18} />
                  </button>
                </>
              )}
              <button
                onClick={handleSend}
                disabled={isProcessing || isUploading || (!inputValue && !attachedFile)}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl px-4 py-3 flex items-center justify-center transition-all shadow-xl"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
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
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md transition-all shadow-lg"
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

      case 'income_bands': {
        const bands = ['< 5 LPA', '5-10 LPA', '10-20 LPA', '> 20 LPA'];
        return (
          <div className="flex flex-wrap gap-2 w-full justify-center">
            {bands.map((band) => (
              <button
                key={band}
                disabled={isProcessing}
                onClick={() => onReply(band)}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white border border-white/10 rounded-full px-6 py-2 transition-all hover:scale-105 active:scale-95 shadow-md backdrop-blur-sm"
              >
                {band}
              </button>
            ))}
          </div>
        );
      }

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
              className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white border border-white/10 rounded-xl px-8 py-3 transition-all hover:scale-105 active:scale-95 shadow-lg backdrop-blur-sm"
            >
              No
            </button>
          </div>
        );

      case 'slider':
        return (
          <div className="w-full flex flex-col gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl">
            <div className="flex justify-between items-center px-2">
              <span className="text-white/60 text-sm font-medium uppercase tracking-wider">Requested Range</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                ₹ {inputValue || 1} Lakh
              </span>
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
              <Info size={16} className="text-indigo-400" />
              <p className="text-xs text-white/50 uppercase font-semibold">Bank Information Security Tier</p>
            </div>
            <input
              type="text"
              placeholder="IFSC Code"
              disabled={isProcessing}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md"
            />
            <input
              type="text"
              placeholder="Account Number"
              disabled={isProcessing}
              value={extraValue}
              onChange={(e) => setExtraValue(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md"
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
            <p className="text-center text-white/40 text-xs px-4">
              By submitting, you agree to our terms of service and allow us to verify your provided information.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <WebcamCapture
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={handleWebcamCapture}
      />
      <div className="w-full max-w-4xl mx-auto p-4 flex justify-center items-end bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/80 to-transparent pt-12">
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
    </>
  );
}
