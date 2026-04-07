import { create } from 'zustand';

export type DocumentType = 
  | 'aadhaar' 
  | 'pan' 
  | 'selfie' 
  | 'marksheet' 
  | 'income' 
  | 'passbook' 
  | 'caste';

export type DocumentStatus = 'pending' | 'uploading' | 'uploaded' | 'verified' | 'failed';

interface DocumentState {
  status: DocumentStatus;
  fileName: string | null;
  error: string | null;
}

interface FaceMatchState {
  status: 'pending' | 'verifying' | 'success' | 'failed';
  score: number | null;
}

interface DocumentStore {
  documents: Record<DocumentType, DocumentState>;
  faceMatch: FaceMatchState;
  setDocumentStatus: (
    docType: DocumentType,
    status: DocumentStatus,
    fileName?: string | null,
    error?: string | null
  ) => void;
  setFaceMatchStatus: (status: FaceMatchState['status'], score?: number | null) => void;
  resetStore: () => void;
}

const initialDocuments: Record<DocumentType, DocumentState> = {
  aadhaar: { status: 'pending', fileName: null, error: null },
  pan: { status: 'pending', fileName: null, error: null },
  selfie: { status: 'pending', fileName: null, error: null },
  marksheet: { status: 'pending', fileName: null, error: null },
  income: { status: 'pending', fileName: null, error: null },
  passbook: { status: 'pending', fileName: null, error: null },
  caste: { status: 'pending', fileName: null, error: null },
};

const initialFaceMatch: FaceMatchState = {
  status: 'pending',
  score: null,
};

export const useDocumentStore = create<DocumentStore>()((set) => ({
  documents: initialDocuments,
  faceMatch: initialFaceMatch,
  setDocumentStatus: (docType, status, fileName, error) =>
    set((state) => ({
      documents: {
        ...state.documents,
        [docType]: {
          status,
          fileName: fileName !== undefined ? fileName : state.documents[docType].fileName,
          error: error !== undefined ? error : state.documents[docType].error,
        },
      },
    })),
  setFaceMatchStatus: (status, score) =>
    set((state) => ({
      faceMatch: {
        status,
        score: score !== undefined ? score : state.faceMatch.score,
      },
    })),
  resetStore: () =>
    set({
      documents: initialDocuments,
      faceMatch: initialFaceMatch,
    }),
}));
