import { create } from 'zustand';

export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  amount: string;
  deadline: string;
  matchScore: number;
  tags: string[];
  status: 'not_applied' | 'pending' | 'awarded';
}

interface ScholarshipStore {
  scholarships: Scholarship[];
  isLoading: boolean;
  setScholarships: (data: Scholarship[]) => void;
  applyToScholarship: (id: string) => void;
  setLoading: (status: boolean) => void;
}

const dummyScholarships: Scholarship[] = [
  {
    id: '1',
    name: 'Top Talent Merit Scholarship',
    provider: 'Global Education Foundation',
    amount: '₹50,000',
    deadline: '2026-06-30',
    matchScore: 95,
    tags: ['Merit Based', 'High Score'],
    status: 'not_applied',
  },
  {
    id: '2',
    name: 'Opportunity Need-Based Grant',
    provider: 'Lupin Trust',
    amount: '₹2,00,000',
    deadline: '2026-05-15',
    matchScore: 80,
    tags: ['Need Based', 'Engineering'],
    status: 'not_applied',
  },
  {
    id: '3',
    name: 'Maharashtra State Scholarship',
    provider: 'Govt. of Maharashtra',
    amount: '₹15,000',
    deadline: '2026-08-20',
    matchScore: 70,
    tags: ['State Grant', 'Regional'],
    status: 'not_applied',
  },
  {
    id: '4',
    name: 'Women in STEM Award',
    provider: 'Tech Pioneers Academy',
    amount: '₹75,000',
    deadline: '2026-07-01',
    matchScore: 85,
    tags: ['Diversity', 'STEM'],
    status: 'not_applied',
  },
];

export const useScholarshipStore = create<ScholarshipStore>((set) => ({
  scholarships: dummyScholarships,
  isLoading: false,
  setScholarships: (data) => set({ scholarships: data }),
  applyToScholarship: (id) =>
    set((state) => ({
      scholarships: state.scholarships.map((s) =>
        s.id === id ? { ...s, status: 'pending' } : s
      ),
    })),
  setLoading: (status) => set({ isLoading: status }),
}));
