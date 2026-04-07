import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { Question } from '@/store/assessmentStore';

// 1. Create a single Axios instance named apiClient
export const apiClient = axios.create({
  baseURL: 'https://api.loanai.dev/v1',
  timeout: 10000,
});

/**
 * 2. Request Interceptor (Future-proofing)
 * 
 * This logic will be activated later when real backend is ready.
 * It's prepared to automatically add the JWT token to all requests.
 */
apiClient.interceptors.request.use(
  (config) => {
    /**
     * Logic for getting token from useAuthStore (Zustand):
     * const token = useAuthStore.getState().accessToken;
     * if (token) {
     *   config.headers.Authorization = `Bearer ${token}`;
     * }
     */
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 3. Response Interceptor (Future-proofing)
 * 
 * Handles common response scenarios like 401 Unauthorized or 500 Server errors.
 */
apiClient.interceptors.response.use(
  (response) => {
    // For successful responses, we just return the response object
    return response;
  },
  (error) => {
    // Log the error for debugging
    console.error('API Error:', error.response || error.message);

    if (error.response) {
      const { status } = error.response;

      /**
       * Handle 401 (Unauthorized) errors
       * This is where refresh token logic usually goes.
       * 
       * if (status === 401) {
       *   // Logout user or refresh token
       *   useAuthStore.getState().logout();
       *   window.location.href = '/login';
       * }
       */

      /**
       * Handle 500 (Internal Server Error)
       * This is where generic error toasts would be triggered.
       * 
       * if (status >= 500) {
       *   toast.error('Something went wrong on our end. Please try again later.');
       * }
       */
    }

    return Promise.reject(error);
  }
);

// --- Dummy API Functions for Simulation ---

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulated register function
 */
export async function registerUser(data: any) {
  console.log('Registering user:', data);
  
  // Wait for 1.5 seconds to simulate API lag
  await delay(1500);
  
  return { 
    success: true, 
    message: 'User registered successfully!' 
  };
}

/**
 * Simulated login function
 */
export async function loginUser(credentials: { email: string; password?: string }) {
  console.log('Logging in user:', credentials);
  
  // Wait for 1.5 seconds to simulate API lag
  await delay(1500);
  
  const dummyResponse = {
    success: true,
    data: {
      accessToken: 'dummy-jwt-token-string',
      user: {
        id: 'user-123',
        name: 'Rajan Kumar',
      },
    },
  };

  return dummyResponse;
}

/**
 * Simulated document upload function
 */
export async function uploadDocument(docType: string, file: File) {
  console.log(`Uploading ${docType}: ${file.name}`);
  
  // Wait for 2 seconds to simulate API lag
  await delay(2000);
  
  // Simulate success 90% of the time, failure 10%
  const isError = Math.random() < 0.1;

  if (isError) {
    throw new Error('Upload failed unexpectedly.');
  }

  return {
    success: true,
    data: {
      fileName: file.name,
    },
  };
}

/**
 * Simulated get application status function
 */
export async function getApplicationStatus(applicationId: string | null) {
  console.log(`Polling status for application: ${applicationId}`);
  
  // Wait for 1 second to simulate API lag
  await delay(1000);
  
  // Randomly pick a stage to update for simulation
  const stages = ['verified', 'assessment', 'fraud', 'eligibility', 'decision'];
  const randomStage = stages[Math.floor(Math.random() * stages.length)];
  const statuses: ('pending' | 'done' | 'failed' | 'flagged')[] = ['pending', 'done', 'failed', 'flagged'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

  return {
    success: true,
    data: {
      stageId: randomStage,
      newStatus: randomStatus,
    },
  };
}

/**
 * Simulated get behavioral questions function
 */
export const getBehavioralQuestions = async (): Promise<Question[]> => {
  // Simulate a 1-second network delay
  await new Promise(res => setTimeout(res, 1000));

  return [
    { question_id: 'q1', type: 'mcq', question_text: 'How do you handle tight deadlines?', options: ['I panic', 'I plan and prioritize', 'I ask for extensions', 'I work all night'] },
    { question_id: 'q2', type: 'mcq', question_text: 'If a team member is falling behind, what do you do?', options: ['Ignore it', 'Do their work for them', 'Offer help and find the blocker', 'Report them'] },
    { question_id: 'q3', type: 'free_text', question_text: 'Describe a time you overcame a significant financial challenge.', options: null }
  ];
};

/**
 * Simulated submit behavioral answers function
 */
export const submitBehavioralAnswers = async (answers: any) => {
  console.log("Submitting answers to AI:", answers);
  
  // Simulate a 3-second delay to mimic AI evaluation
  await new Promise(res => setTimeout(res, 3000));
  
  return { success: true };
};

/**
 * Simulated get eligibility score function
 */
export const getEligibilityScore = async (appId: string) => {
  await new Promise(res => setTimeout(res, 1000));
  return {
    status: 'approved',
    approvedAmount: 500000,
    interestRate: '8.5%',
    pqScore: 88,
    overrideApplied: true,
    radarData: [
      { subject: 'Financial', A: 45, fullMark: 100 },
      { subject: 'Academic', A: 80, fullMark: 100 },
      { subject: 'Behavioral', A: 92, fullMark: 100 },
      { subject: 'Market', A: 75, fullMark: 100 },
      { subject: 'Social', A: 60, fullMark: 100 }
    ]
  };
};

/**
 * Simulated get disbursal schedule function
 */
export const getDisbursalSchedule = async (appId: string) => {
  await new Promise(res => setTimeout(res, 500));
  return [
    { semester: 1, amount: 62500, date: '2024-08-01', status: 'pending' },
    { semester: 2, amount: 62500, date: '2025-01-01', status: 'locked' },
    { semester: 3, amount: 62500, date: '2025-08-01', status: 'locked' }
  ];
};

/**
 * Simulated get matched scholarships function
 */
export const getMatchedScholarships = async (appId: string) => {
  await new Promise(res => setTimeout(res, 500));
  return [
    { id: 's1', name: 'Tech Innovators Grant', amount: 25000, deadline: '2024-05-30' },
    { id: 's2', name: 'State Merit Scholarship', amount: 15000, deadline: '2024-06-15' }
  ];
};
