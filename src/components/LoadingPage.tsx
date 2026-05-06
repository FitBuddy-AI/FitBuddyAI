import React, { useEffect, useState } from 'react';
import './LoadingPage.css';
import { Dumbbell, Target, Calendar, Zap } from 'lucide-react';

const LOADING_PROGRESS_KEY = 'fitbuddyai_loading_progress';

type LoadingProgressState = {
  progress: number;
  stage: string;
  currentStep: number;
  totalSteps: number;
  updatedAt: number;
};

const readLoadingProgress = (): LoadingProgressState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LOADING_PROGRESS_KEY) || localStorage.getItem(LOADING_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
};

const LoadingPage: React.FC = () => {
  const [progressState, setProgressState] = useState<LoadingProgressState | null>(() => readLoadingProgress());

  useEffect(() => {
    const sync = () => setProgressState(readLoadingProgress());
    sync();
    window.addEventListener('fitbuddyai-loading-progress', sync as EventListener);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('fitbuddyai-loading-progress', sync as EventListener);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const progress = Math.max(0, Math.min(100, Math.round(progressState?.progress ?? 0)));
  const stage = progressState?.stage || 'Your personalized plan is on its way...';
  const detail = progressState?.totalSteps
    ? `Step ${Math.min(progressState.currentStep || 0, progressState.totalSteps)} of ${progressState.totalSteps}`
    : 'Working through your plan';

  return (
    <div className="loading-screen">
      <div className="loading-container fade-in-bounce">
        <div className="loading-dumbbell">
          <Dumbbell size={40} color="#fff" />
        </div>
        <div className="loading-icons">
          <div className="loading-icon-pill">
            <Target size={18} />
            <span>Goals</span>
          </div>
          <div className="loading-icon-pill">
            <Calendar size={18} />
            <span>Schedule</span>
          </div>
          <div className="loading-icon-pill">
            <Zap size={18} />
            <span>Energy</span>
          </div>
          <div className="loading-icon-pill">
            <Dumbbell size={18} />
            <span>Strength</span>
          </div>
        </div>
        <h2 className="loading-title">Hang tight!</h2>
        <p className="loading-desc">{stage}</p>
        <div className={`loading-progress ${progress < 100 ? 'loading-progress-active' : 'loading-progress-complete'}`} aria-label={`Plan generation progress ${progress}%`}>
          <div className="loading-progress-track">
            <progress className="loading-progress-fill" value={progress} max={100} />
          </div>
          <div className="loading-progress-meta">
            <span>{detail}</span>
            <span>{progress}%</span>
          </div>
        </div>
        <p className="ai-disclaimer">Disclaimer: This plan is AI-generated and may not be perfect for everyone. Check important info.</p>
      </div>
    </div>
  );
};

export default LoadingPage;
