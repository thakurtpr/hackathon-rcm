'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Paperclip, Camera, FileText } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import { sendChatMessage, uploadDocument } from '@/lib/api';
import { WebcamCapture } from '@/components/kyc/WebcamCapture';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatWidget() {
  const {
    isOpen,
    messages,
    isTyping,
    toggleChat,
    addMessage,
    setTyping,
  } = useChatStore();

  const [inputValue, setInputValue] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Revoke object URL when file removed
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File too large. Maximum 10 MB.');
      return;
    }
    setUploadError(null);
    setAttachedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeAttachment = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
  };

  const sendMessage = useCallback(async (text: string) => {
    addMessage({ sender: 'user', text });
    setTyping(true);
    try {
      const sessionId = typeof window !== 'undefined' ? sessionStorage.getItem('chat_session') ?? undefined : undefined;
      const response = await sendChatMessage(text, sessionId);
      const reply = response?.response || response?.message || "I can help you with your loan status, disbursal schedule, scholarship matches, and more.";
      addMessage({ sender: 'bot', text: reply });
      if (response?.session_id && typeof window !== 'undefined') {
        sessionStorage.setItem('chat_session', response.session_id);
      }
    } catch {
      addMessage({ sender: 'bot', text: 'I apologize, I am temporarily unavailable. Please try again.' });
    } finally {
      setTyping(false);
    }
  }, [addMessage, setTyping]);

  const handleSendMessage = async () => {
    const text = inputValue.trim();

    if (attachedFile) {
      setIsUploading(true);
      setUploadError(null);
      const docType = detectDocType(attachedFile.name);
      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') ?? undefined : undefined;
      try {
        await uploadDocument(docType, attachedFile, userId);
        const uploadMsg = `I have uploaded ${attachedFile.name}`;
        removeAttachment();
        await sendMessage(uploadMsg);
        if (text) {
          setInputValue('');
          await sendMessage(text);
        }
      } catch {
        setUploadError('Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (!text) return;
    setInputValue('');
    await sendMessage(text);
  };

  const handleWebcamCapture = async (file: File) => {
    setIsWebcamOpen(false);
    setIsUploading(true);
    setUploadError(null);
    const userId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') ?? undefined : undefined;
    try {
      await uploadDocument('selfie', file, userId);
      await sendMessage(`I have uploaded ${file.name}`);
    } catch {
      setUploadError('Selfie upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Webcam Modal */}
      <WebcamCapture
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={handleWebcamCapture}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-semibold text-sm">AI Assistant</span>
            </div>
            <button
              onClick={toggleChat}
              className="hover:bg-gray-700 p-1 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent bg-[#0b0f1a]"
            style={{ maxHeight: '320px', minHeight: '200px' }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed",
                  msg.sender === 'user'
                    ? "bg-blue-600 text-white ml-auto rounded-tr-none shadow-md"
                    : "bg-gray-800 text-gray-200 mr-auto rounded-tl-none border border-gray-700"
                )}
              >
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-1 items-center px-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 animate-pulse">
                  AI is typing...
                </span>
              </div>
            )}
          </div>

          {/* File Preview */}
          {attachedFile && (
            <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
              <div className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <FileText className="w-6 h-6 text-indigo-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{attachedFile.name}</p>
                  <p className="text-[10px] text-gray-400">{formatFileSize(attachedFile.size)}</p>
                </div>
                <button onClick={removeAttachment} className="text-gray-400 hover:text-white shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <div className="px-4 py-1 bg-gray-800">
              <p className="text-xs text-rose-400">{uploadError}</p>
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-gray-800 border-t border-gray-700 flex items-center gap-2">
            <button
              onClick={() => setIsWebcamOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title="Capture selfie"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
              disabled={isUploading}
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-600 p-2 rounded-xl text-white hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-blue-500/20"
              disabled={(!inputValue.trim() && !attachedFile) || isUploading}
            >
              {isUploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={toggleChat}
        className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-90 transition-all duration-300 ring-4 ring-black/10 group"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
        ) : (
          <MessageCircle className="w-6 h-6 transition-transform group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
