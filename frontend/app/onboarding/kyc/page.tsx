'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentStore, DocumentType } from '@/store/documentStore';
import { useAuthStore } from '@/store/authStore';
import { DocumentCard } from '@/components/kyc/DocumentCard';
import { WebcamCapture } from '@/components/kyc/WebcamCapture';
import { FaceMatchResult } from '@/components/onboarding/FaceMatchResult';
import { Button } from '@/components/ui/button';
import { uploadDocument, getUserDocumentsStatus, getOcrResult, sendChatMessage } from '@/lib/api';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, ShieldCheck, ScanFace, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const REQUIRED_DOCS: DocumentType[] = ['aadhaar', 'pan', 'selfie', 'marksheet'];

export default function KYCPage() {
  const router = useRouter();
  const { documents, faceMatch, setDocumentStatus, setFaceMatchStatus } = useDocumentStore();
  const { userId } = useAuthStore();
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [missingDocs, setMissingDocs] = useState<string[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which doc types we've already sent OCR chat messages for
  const ocrSentRef = useRef<Set<string>>(new Set());

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
        // Mark as uploaded (not yet verified — verification comes from backend polling)
        setDocumentStatus(docType as DocumentType, 'uploaded', file.name);
        // If Aadhaar or Selfie just uploaded and the other is already uploaded/verified,
        // set face match to verifying immediately so the UI reacts.
        if (docType === 'aadhaar') {
          const selfieReady = ['uploaded', 'verified'].includes(documents.selfie.status);
          if (selfieReady && faceMatch.status === 'pending') {
            setFaceMatchStatus('verifying');
          }
        }
        if (docType === 'selfie') {
          const aadhaarReady = ['uploaded', 'verified'].includes(documents.aadhaar.status);
          if (aadhaarReady && faceMatch.status === 'pending') {
            setFaceMatchStatus('verifying');
          }
        }
      }
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error);
      setDocumentStatus(docType as DocumentType, 'failed', null, 'Upload failed. Please try again.');
    }
  };

  const handleRetry = (docType: DocumentType) => {
    setDocumentStatus(docType, 'pending', null, null);
    if (docType === 'aadhaar' || docType === 'selfie') {
      setFaceMatchStatus('pending');
    }
  };

  const requiredVerifiedCount = useMemo(
    () => REQUIRED_DOCS.filter((d) => documents[d].status === 'verified').length,
    [documents]
  );
  const allRequiredVerified = requiredVerifiedCount === REQUIRED_DOCS.length;
  const faceMatchPassed = faceMatch.status === 'success';
  const canProceed = allRequiredVerified && faceMatchPassed;

  const totalVerifiedCount = useMemo(
    () => docConfig.filter((doc) => documents[doc.id].status === 'verified').length,
    [documents]
  );
  const progressPercentage = (totalVerifiedCount / docConfig.length) * 100;

  // Derived: Aadhaar and Selfie upload state for face verification banner
  const aadhaarUploaded = ['uploaded', 'verified'].includes(documents.aadhaar.status);
  const selfieUploaded = ['uploaded', 'verified'].includes(documents.selfie.status);
  const bothUploaded = aadhaarUploaded && selfieUploaded;

  // Poll backend every 4 seconds for real document + face match status
  useEffect(() => {
    if (!userId) return;

    pollingRef.current = setInterval(async () => {
      try {
        const { documents: docMap, face_match_result, face_match_score } = await getUserDocumentsStatus(userId);

        // Update document statuses + fetch OCR for newly verified docs
        await Promise.all(
          Object.entries(docMap).map(async ([docType, docStatus]) => {
            const dt = docType as DocumentType;
            const wasVerified = documents[dt]?.status === 'verified';
            if (docStatus === 'verified' && !wasVerified) {
              setDocumentStatus(dt, 'verified');
              // Option C: send OCR results to AI chat after verification
              if (!ocrSentRef.current.has(docType) && docType !== 'selfie') {
                ocrSentRef.current.add(docType);
                // Small delay to let OCR pipeline finish writing to Redis
                setTimeout(async () => {
                  try {
                    const ocrData = await getOcrResult(userId, docType);
                    if (ocrData && ocrData.fields && Object.keys(ocrData.fields).length > 0) {
                      const fieldLines = Object.entries(ocrData.fields)
                        .filter(([, v]) => v !== null && v !== '')
                        .map(([k, v]) => `• ${k.replace(/_/g, ' ')}: ${v}`)
                        .join('\n');
                      const msg = `✅ I've verified your ${docType.replace(/_/g, ' ').toUpperCase()} document. Here's what was extracted:\n\n${fieldLines}\n\nTrust score: ${Math.round((ocrData.doc_trust_score ?? 0) * 100)}%`;
                      const convId = typeof window !== 'undefined' ? sessionStorage.getItem('chat_session') ?? undefined : undefined;
                      await sendChatMessage(msg, convId);
                    }
                  } catch {
                    // silent — OCR result fetch is best-effort
                  }
                }, 6000); // 6s delay for Kafka pipeline to complete
              }
            }
          })
        );

        // Update face match status from backend
        if (face_match_result === 'verified') {
          const scorePercent = face_match_score != null ? Math.round(face_match_score * 100) : null;
          setFaceMatchStatus('success', scorePercent);
        } else if (face_match_result === 'failed') {
          setFaceMatchStatus('failed');
        } else if (face_match_result === 'manual_review') {
          // Treat manual_review as failed from the user's perspective — they need to retry
          setFaceMatchStatus('failed');
        } else if (bothUploaded && faceMatch.status === 'pending') {
          // Both uploaded but backend hasn't responded yet — show verifying
          setFaceMatchStatus('verifying');
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, bothUploaded]);

  /** Validate required docs before allowing navigation to assessment */
  const handleContinueClick = () => {
    const missing: string[] = [];
    const docNames: Record<DocumentType, string> = {
      aadhaar: 'Aadhaar Card',
      pan: 'PAN Card',
      selfie: 'Selfie / Live Photo',
      marksheet: 'Latest Marksheet',
      income: 'Income Certificate',
      passbook: 'Bank Passbook',
      caste: 'Caste Certificate',
    };
    for (const d of REQUIRED_DOCS) {
      if (!['uploaded', 'verified'].includes(documents[d].status)) {
        missing.push(docNames[d] ?? d);
      }
    }
    if (!faceMatchPassed) {
      missing.push('Face Verification');
    }
    if (missing.length > 0) {
      setMissingDocs(missing);
      return;
    }
    setMissingDocs([]);
    router.push('/assessment');
  };

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
                All required documents verified! Complete face verification below to continue.
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

        {/* Face Verification Step */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border",
              faceMatchPassed
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                : faceMatch.status === 'failed'
                ? "bg-rose-500/20 border-rose-500/50 text-rose-400"
                : "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"
            )}>
              2
            </div>
            <h2 className="text-xl font-bold">Biometric Face Verification</h2>
          </div>

          {/* State: waiting for Aadhaar */}
          {!aadhaarUploaded && (
            <div className="flex items-center gap-4 p-5 bg-gray-900/40 border border-gray-800 rounded-2xl">
              <ScanFace className="w-8 h-8 text-gray-500 shrink-0" />
              <div>
                <p className="font-semibold text-gray-300">Upload Aadhaar Card to begin</p>
                <p className="text-sm text-gray-500">Your Aadhaar photo will be matched against your selfie</p>
              </div>
            </div>
          )}

          {/* State: Aadhaar uploaded, waiting for selfie */}
          {aadhaarUploaded && !selfieUploaded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4 p-5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl"
            >
              <div className="relative shrink-0">
                <ScanFace className="w-8 h-8 text-indigo-400" />
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-400"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              </div>
              <div>
                <p className="font-semibold text-indigo-200">Aadhaar received — now upload your Selfie</p>
                <p className="text-sm text-indigo-300/70">
                  Once both are uploaded, face recognition will run automatically to verify your identity
                </p>
              </div>
            </motion.div>
          )}

          {/* State: both uploaded — show face match result */}
          {bothUploaded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl"
            >
              <FaceMatchResult
                status={faceMatch.status}
                score={faceMatch.score}
                onRetryAadhaar={() => handleRetry('aadhaar')}
                onRetrySelfie={() => handleRetry('selfie')}
              />
            </motion.div>
          )}

          {/* Face match failed — cannot proceed warning */}
          {faceMatch.status === 'failed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl max-w-2xl"
            >
              <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-rose-300 text-sm">
                Identity verification failed. You cannot proceed to the assessment until face verification passes.
                Please re-upload a clear front-facing Aadhaar or retake your selfie.
              </p>
            </motion.div>
          )}
        </motion.div>

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

          <div className="flex flex-col items-end gap-2">
            {/* Validation error: missing doc list */}
            {missingDocs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl max-w-xs text-right"
              >
                <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-300 mb-1">Still required:</p>
                  <ul className="text-xs text-amber-400/80 space-y-0.5">
                    {missingDocs.map((d) => (
                      <li key={d}>• {d}</li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
            {allRequiredVerified && !faceMatchPassed && faceMatch.status !== 'verifying' && (
              <p className="text-xs text-amber-400/80">
                {faceMatch.status === 'failed'
                  ? 'Face verification failed — re-upload to retry'
                  : 'Waiting for face verification to complete...'}
              </p>
            )}
            <Button
              size="lg"
              onClick={handleContinueClick}
              className={cn(
                'w-full sm:w-auto h-16 px-10 rounded-2xl text-lg font-bold transition-all duration-300',
                canProceed
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-gray-700 hover:text-gray-300'
              )}
            >
              Continue to Assessment
              <ChevronRight className="ml-2 w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
