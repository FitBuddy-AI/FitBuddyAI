import React from 'react';
import './SettingsPage.css';

type Theme = 'theme-light' | 'theme-dark';

interface SettingsPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  homeIntroEnabled: boolean;
  onToggleHomeIntro: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onToggleTheme, homeIntroEnabled, onToggleHomeIntro }) => {
  const isDark = theme === 'theme-dark';
  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-header">
          <h1>Settings</h1>
          <p className="settings-subtitle">Personalize your FitBuddyAI experience.</p>
        </div>

        <div className="settings-section">
          <div className="settings-row">
            <div>
              <h3>Theme</h3>
              <p className="setting-help">Switch between light and dark mode.</p>
            </div>
            <button className="toggle-btn" onClick={onToggleTheme}>
              {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
          </div>

          <div className="settings-row">
            <div>
              <h3>Home intro animation</h3>
              <p className="setting-help">Play the new particle-heavy intro when you open the home page.</p>
            </div>
            <button className="toggle-btn" onClick={onToggleHomeIntro}>
              {homeIntroEnabled ? 'Disable Intro' : 'Enable Intro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
