import { create } from 'zustand';

export interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'done' | 'failed' | 'flagged';
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface ApplicationStore {
  applicationId: string | null;
  pipelineStages: PipelineStage[];
  webSocketStatus: ConnectionStatus;
  setApplicationId: (id: string) => void;
  updateStageStatus: (stageId: string, status: PipelineStage['status']) => void;
  setWebSocketStatus: (status: ConnectionStatus) => void;
  resetStore: () => void;
}

const initialStages: PipelineStage[] = [
  { id: 'submitted', name: 'Application submitted', status: 'done' },
  { id: 'verified', name: 'Documents verified', status: 'pending' },
  { id: 'assessment', name: 'Behavioral assessment', status: 'pending' },
  { id: 'fraud', name: 'Fraud check', status: 'pending' },
  { id: 'eligibility', name: 'Eligibility scoring', status: 'pending' },
  { id: 'decision', name: 'Final decision', status: 'pending' },
];

const initialState = {
  applicationId: null,
  pipelineStages: initialStages,
  webSocketStatus: 'disconnected' as ConnectionStatus,
};

export const useApplicationStore = create<ApplicationStore>((set) => ({
  ...initialState,
  setApplicationId: (id) => set({ applicationId: id }),
  updateStageStatus: (stageId, status) =>
    set((state) => ({
      pipelineStages: state.pipelineStages.map((stage) =>
        stage.id === stageId ? { ...stage, status } : stage
      ),
    })),
  setWebSocketStatus: (status) => set({ webSocketStatus: status }),
  resetStore: () => set(initialState),
}));
