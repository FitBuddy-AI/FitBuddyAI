import React, { useEffect, useState } from 'react';
import { setAcceptanceFlags } from '../services/localStorage';
import { hasAcceptedAll, hasAcceptedTos, hasAcceptedPrivacy, acceptTos, acceptPrivacy, migrateAnonToUser } from '../services/tosService';
import './AgreementGuard.css';

type Props = { userData?: any; children: React.ReactNode };

export default function AgreementGuard({ userData, children }: Props) {
  const [visible, setVisible] = useState(false);
  

  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      try { migrateAnonToUser(userData.id); } catch (_e) { /* noop */ }
    }

    let cancelled = false;

    const check = async () => {
      const localAccepted = hasAcceptedAll(userData?.id);
      setTosAccepted(hasAcceptedTos(userData?.id));
      setPrivacyAccepted(hasAcceptedPrivacy(userData?.id));

      if (localAccepted) {
        if (!cancelled) setVisible(false);
        return;
      }

      const uid = userData?.id;
      if (!uid) {
        if (!cancelled) setVisible(true);
        return;
      }

      try {
        const init = await import('../services/apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid }) }));
        const res = await fetch('/api/userdata/load', init);
        if (!res.ok) {
          if (!cancelled) setVisible(true);
          return;
        }

        const text = await res.text();
        let parsed: any = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (_e) { parsed = null; }
        const payload = parsed?.stored ?? parsed?.payload ?? parsed ?? {};
        const serverAccepted = Boolean(payload && payload.accepted_terms && payload.accepted_privacy);
        if (serverAccepted) {
          try { setAcceptanceFlags({ accepted_terms: true, accepted_privacy: true }); } catch (_e) { /* noop */ }
        }
        if (!cancelled) setVisible(!serverAccepted);
      } catch (_e) {
        if (!cancelled) setVisible(!localAccepted);
      }
    };

    check();
    const onTos = () => { setTosAccepted(true); setVisible(!hasAcceptedAll(userData?.id)); };
    const onPrivacy = () => { setPrivacyAccepted(true); setVisible(!hasAcceptedAll(userData?.id)); };
    window.addEventListener('fitbuddyai-tos-accepted', onTos);
    window.addEventListener('fitbuddyai-privacy-accepted', onPrivacy);
    return () => {
      cancelled = true;
      window.removeEventListener('fitbuddyai-tos-accepted', onTos);
      window.removeEventListener('fitbuddyai-privacy-accepted', onPrivacy);
    };
  }, [userData?.id]);

  if (!visible) return <>{children}</>;

  const handleAgree = () => {
    // Mark both as accepted locally (migrated to user if signed in by tosService)
    try { acceptTos(userData?.id); } catch (_e) { /* noop */ }
    try { acceptPrivacy(userData?.id); } catch (_e) { /* noop */ }
    try { setAcceptanceFlags({ accepted_terms: true, accepted_privacy: true }); } catch (_e) { /* noop */ }
    // If user is signed in, persist acceptance to the server as well
    if (userData?.id) {
      try {
        import('../services/apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userData.id, accepted_terms: true, accepted_privacy: true }) })).then(init => {
          fetch('/api/userdata/save', init).catch(() => { /* ignore server errors quietly */ });
        }).catch(() => {});
      } catch (_e) {
        // ignore
      }
    }
    setVisible(false);
  };

  return (
    <div className="agreement-guard-wrapper" aria-hidden="false">
      {/* Render children but visually de-emphasize while modal is active */}
      <div className="agreement-guard-underlay" aria-hidden="true">{children}</div>
      <div className="agreement-guard-backdrop" role="dialog" aria-modal="true" aria-label="Terms and Privacy agreement">
        <div className="agreement-guard-modal" role="document">
          <h2 className="agreement-guard-title">Before you continue</h2>
          <p className="agreement-guard-body">To continue, please agree to our <a className={tosAccepted? 'agreement-accepted' : ''} href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a className={privacyAccepted? 'agreement-accepted' : ''} href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. Both will open in a new tab if you want to review them.</p>
          <div className="agreement-guard-actions">
            <button className="btn btn-agree" onClick={handleAgree}>I have read and agree</button>
          </div>
        </div>
      </div>
    </div>
  );
}
