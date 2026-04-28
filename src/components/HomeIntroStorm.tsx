import React, { useEffect, useRef, useState } from 'react';
import { Brain, ChevronRight, Dumbbell, Flame, ShieldCheck, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import './HomeIntroStorm.css';

const particleVariants = Array.from({ length: 24 }, (_, index) => index);

const orbitCards = [
  { label: 'Assess', icon: Target, note: 'questions shape the plan' },
  { label: 'Adapt', icon: Brain, note: 'plans respond to progress' },
  { label: 'Recover', icon: ShieldCheck, note: 'recovery remains visible' },
  { label: 'Advance', icon: TrendingUp, note: 'each week moves forward' },
];

const trailLabels = ['Launch', 'Focus', 'Momentum'];

const HomeIntroStorm: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [phase, setPhase] = useState<'ignite' | 'storm' | 'surge' | 'fade'>('ignite');
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase('storm'), 900),
      window.setTimeout(() => setPhase('surge'), 2600),
      window.setTimeout(() => setPhase('fade'), 5400),
      window.setTimeout(() => onFinishRef.current(), 6400),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={`home-intro-storm phase-${phase}`} role="presentation" aria-hidden="true">
      <div className="home-intro-storm__sky">
        <span className="sky-orb sky-orb-a" />
        <span className="sky-orb sky-orb-b" />
        <span className="sky-orb sky-orb-c" />
        <span className="sky-orb sky-orb-d" />
        <span className="sky-grid" />
      </div>

      <div className="home-intro-storm__rings">
        <span className="ring ring-1" />
        <span className="ring ring-2" />
        <span className="ring ring-3" />
        <span className="ring ring-4" />
      </div>

      <div className="home-intro-storm__particles">
        {particleVariants.map((index) => (
          <span key={index} className={`particle particle-${index % 6} particle-slot-${index}`} />
        ))}
      </div>

      <div className="home-intro-storm__orbits">
        {orbitCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`orbit-card orbit-card-${index + 1}`}>
              <span className="orbit-card__icon"><Icon size={16} /></span>
              <strong>{card.label}</strong>
              <span>{card.note}</span>
            </div>
          );
        })}
      </div>

      <div className="home-intro-storm__center">
        <div className="center-panel-bg" />
        <div className="center-logo">
          <Dumbbell size={48} />
        </div>
        <div className="center-copy">
          <span className="center-kicker"><Sparkles size={16} /> Welcome to FitBuddyAI</span>
          <h2>Training starts with a calmer, sharper launch.</h2>
          <p>
            A refined particle field, guided motion, and clear rhythm turn the home screen into a professional launch sequence.
          </p>
        </div>
        <div className="center-trail" aria-hidden="true">
          {trailLabels.map((label, index) => (
            <span key={label} className={`trail-chip trail-chip-${index + 1}`}>
              {label}
              <ChevronRight size={14} />
            </span>
          ))}
        </div>
        <div className="center-metrics">
          <div>
            <strong>Adaptive</strong>
            <span>progressive weekly plan</span>
          </div>
          <div>
            <strong>Focused</strong>
            <span>one clear call to action</span>
          </div>
          <div>
            <strong>Premium</strong>
            <span>cinematic but restrained motion</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeIntroStorm;