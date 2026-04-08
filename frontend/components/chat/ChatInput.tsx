'use client';

import React, { useRef, useEffect, KeyboardEvent, useState } from 'react';
import { Send, Paperclip, X, FileText, Loader2, Image as ImageIcon } from 'lucide-react';

export interface AttachedFile {
  file: File;
  previewUrl?: string;
}

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onFileUpload?: (file: File) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  isUploading?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onFileUpload,
  disabled = false,
  placeholder = 'Message ScholarFlow AI...',
  isUploading = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<AttachedFile | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  // Re-focus input when AI finishes typing (disabled: true → false)
  const prevDisabled = useRef(disabled);
  useEffect(() => {
    if (prevDisabled.current && !disabled) {
      // Small delay so the browser settles before we steal focus
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
    prevDisabled.current = disabled;
  }, [disabled]);

  // Focus on initial mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || pendingFile) && !disabled && !isUploading) handleSendWithFile();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    setPendingFile({ file, previewUrl });
    // reset so same file can be picked again
    e.target.value = '';
  };

  const handleSendWithFile = async () => {
    if (pendingFile && onFileUpload) {
      await onFileUpload(pendingFile.file);
      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
    } else {
      onSend();
    }
  };

  const removePendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isDisabled = disabled || isUploading;
  const canSend = (value.trim() || pendingFile) && !isDisabled;

  return (
    <div className="p-4 bg-[#0d0d14] border-t border-white/5">
      {/* File preview chip */}
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-300 max-w-xs group">
            {pendingFile.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingFile.previewUrl}
                alt="preview"
                className="w-8 h-8 rounded-lg object-cover border border-white/10 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                {getFileIcon(pendingFile.file)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium truncate max-w-[160px]">{pendingFile.file.name}</p>
              <p className="text-indigo-400/60 text-[10px]">{formatFileSize(pendingFile.file.size)}</p>
            </div>
            <button
              onClick={removePendingFile}
              className="ml-1 p-0.5 rounded-md text-indigo-400/60 hover:text-indigo-300 hover:bg-indigo-500/20 transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
        />

        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          title="Attach document (PDF, JPG, PNG)"
          className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-500 hover:text-indigo-400 transition-all active:scale-95 flex-shrink-0"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </button>

        {/* Textarea */}
        <div className="flex-1 bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingFile ? 'Add a message with your file…' : placeholder}
            disabled={isDisabled}
            rows={1}
            className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-600 resize-none outline-none leading-relaxed disabled:opacity-50"
            style={{ maxHeight: '160px' }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSendWithFile}
          disabled={!canSend}
          className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all active:scale-95 flex-shrink-0 shadow-lg shadow-indigo-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
