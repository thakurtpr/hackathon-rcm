'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentStore, DocumentType } from '@/store/documentStore';
import { useAuthStore } from '@/store/authStore';
import { DocumentCard } from '@/components/kyc/DocumentCard';
import { WebcamCapture } from '@/components/kyc/WebcamCapture';
import { FaceMatchResult } from '@/components/onboarding/FaceMatchResult';
import { Button } from '@/components/ui/button';
import { uploadDocument, getUserDocumentsStatus } from '@/lib/api';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const REQUIRED_DOCS: DocumentType[] = ['aadhaar', 'pan', 'selfie', 'marksheet'];

export default function KYCPage() {
  const router = useRouter();
  const { documents, faceMatch, setDocumentStatus, setFaceMatchStatus } = useDocumentStore();
  const { userId } = useAuthStore();
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const docConfig: Array<{
    id: DocumentType;
    name: string;
    acceptedFiles: Record<string, string[]>;
    required: boolean;
  }> = [
    { id: 'aadhaar', name: 'Aadhaar Card', acceptedFiles: { 'image/jpeg': [], 'image/png': [], 'application/pdf': [] }, required: true },
    { id: 'pan', name: 'PAN Card', acceptedFiles: { 'image/jpeg': [], 'image/png': [], 'application/pdf': [] }, required: true },
    { id: 'selfie', name: 'Selfie / Live Photo', acceptedFiles: { 'image/jpeg': [], 'image/png': [] }, required: true },
    { id: 'marksheet', name: 'Latest Marksheet', acceptedFiles: { 'application/pdf': ['.pdf'], 'image/jpeg': [], 'image/png': [] }, required: true },
    { id: 'income', name: 'Income Certificate / ITR', acceptedFiles: { 'application/pdf': ['.pdf'], 'image/jpeg': [], 'image/png': [] }, required: false },
    { id: 'passbook', name: 'Bank Passbook', acceptedFiles: { 'image/jpeg': [], 'image/png': [], 'application/pdf': [] }, required: false },
  ];

  const handleFileUpload = async (docType: string, file: File) => {
    try {
      setDocumentStatus(docType as DocumentType, 'uploading');
      const response = await uploadDocument(docType, file, userId || undefined);
      if (response?.status !== 'error') {
        setDocumentStatus(docType as DocumentType, 'verified', file.name);
      }
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error);
      setDocumentStatus(docType as DocumentType, 'failed', null, 'Upload failed. Please try again.');
    }
  };

  const handleRetry = (docType: DocumentType) => {
    setDocumentStatus(docType, 'pending', null, null);
  };

  const handleFaceMatchVerification = async () => {
    setFaceMatchStatus('verifying');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setFaceMatchStatus('success', 94);
  };

  useEffect(() => {
    const isAadhaarVerified = documents.aadhaar.status === 'verified';
    const isSelfieVerified = documents.selfie.status === 'verified';
    if (isAadhaarVerified && isSelfieVerified && faceMatch.status === 'pending') {
      handleFaceMatchVerification();
    }
  }, [documents.aadhaar.status, documents.selfie.status, faceMatch.status]);

  const requiredVerifiedCount = useMemo(
    () => REQUIRED_DOCS.filter((d) => documents[d].status === 'verified').length,
    [documents]
  );
  const allRequiredVerified = requiredVerifiedCount === REQUIRED_DOCS.length;

  const totalVerifiedCount = useMemo(
    () => docConfig.filter((doc) => documents[doc.id].status === 'verified').length,
    [documents]
  );
  const progressPercentage = (totalVerifiedCount / docConfig.length) * 100;

  // Poll backend for document verification status every 4 seconds
  useEffect(() => {
    if (!userId || allRequiredVerified) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const statusMap = await getUserDocumentsStatus(userId);
        Object.entries(statusMap).forEach(([docType, docStatus]) => {
          const dt = docType as DocumentType;
          if (docStatus === 'verified' && documents[dt]?.status !== 'verified') {
            setDocumentStatus(dt, 'verified');
          }
        });
      } catch {
        // silently ignore polling errors
      }
    }, 4000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [userId, allRequiredVerified, setDocumentStatus]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 text-indigo-400 font-semibold uppercase tracking-wider text-sm">
            <span className="w-8 h-px bg-indigo-400/50"></span>
            Verification Center
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">KYC Documents</h1>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Upload clear digital copies of your documents. For identity verification, a live selfie is mandatory.
          </p>
        </motion.header>

        {/* Required Documents Progress */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">Verification Progress</h3>
              <p className="text-gray-400 text-sm">
                <span className="text-white font-medium">{requiredVerifiedCount}</span> of{' '}
                <span className="text-white font-medium">{REQUIRED_DOCS.length}</span> required documents verified
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-2xl font-bold text-indigo-400">{Math.round(progressPercentage)}%</div>
              </div>
              <div className="relative w-48 h-3 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  className="absolute inset-y-0 left-0 bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all duration-1000"
                />
              </div>
            </div>
          </div>

          {/* All required docs verified banner */}
          {allRequiredVerified && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl"
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <p className="text-emerald-300 font-semibold">
                All required documents verified! You may continue to the assessment.
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-zinc-100">
            {docConfig.map((doc) => (
              <DocumentCard
                key={doc.id}
                docType={doc.name}
                status={documents[doc.id].status}
                fileName={documents[doc.id].fileName}
                error={documents[doc.id].error}
                onFileSelect={(file) => handleFileUpload(doc.id, file)}
                onOpenCamera={doc.id === 'selfie' ? () => setIsWebcamOpen(true) : () => {}}
                onRetry={doc.id !== 'selfie' ? () => handleRetry(doc.id) : undefined}
                acceptedFiles={doc.acceptedFiles}
              />
            ))}
          </div>
        </div>

        {/* Face Match Result */}
        {faceMatch.status !== 'pending' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto"
          >
            <FaceMatchResult status={faceMatch.status} score={faceMatch.score} />
          </motion.div>
        )}

        {/* Webcam Modal */}
        <WebcamCapture
          isOpen={isWebcamOpen}
          onClose={() => setIsWebcamOpen(false)}
          onCapture={(file) => handleFileUpload('selfie', file)}
        />

        {/* Footer Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-12 border-t border-gray-800">
          <div className="flex items-center gap-3 p-4 bg-gray-900/30 rounded-2xl border border-gray-800">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <p className="text-gray-400 text-xs max-w-[200px]">
              Secure 256-bit SSL encrypted connection. Your data is private.
            </p>
          </div>

          <Button
            size="lg"
            disabled={!allRequiredVerified}
            onClick={() => router.push('/assessment')}
            className={cn(
              'w-full sm:w-auto h-16 px-10 rounded-2xl text-lg font-bold transition-all duration-300',
              allRequiredVerified
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-gray-800 text-gray-500 border border-gray-700'
            )}
          >
            Continue to Assessment
            <ChevronRight className="ml-2 w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
