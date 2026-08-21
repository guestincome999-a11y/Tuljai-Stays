'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import { verifyAdminOtp } from '../../../src/auth/admin-auth-api';
import { getOrCreateAdminDeviceId } from '../../../src/auth/admin-device';
import { ADMIN_SESSION_REFRESHED_EVENT } from '../../../src/auth/admin-session-events';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { setAuthSession } from '../../../src/auth/auth-session-store';
import { tokenStorage } from '../../../src/auth/token-storage';

const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';

export default function AdminLoginPage() {
  const auth = useAdminAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [testingOtp, setTestingOtp] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setCopiedOtp(false);
    const result = await auth.requestOtp(phoneNumber.trim());

    if (result.success) {
      setOtpRequested(true);
      setExpiresAt(result.expiresAt);
      setTestingOtp(IS_PRODUCTION_BUILD ? null : (result.otpForTesting ?? null));
    }
  }

  function useDevelopmentOtp() {
    if (!testingOtp || IS_PRODUCTION_BUILD) return;
    setOtp(testingOtp);
    setLocalError(null);
  }

  async function copyDevelopmentOtp() {
    if (!testingOtp || IS_PRODUCTION_BUILD || !navigator.clipboard) return;
    await navigator.clipboard.writeText(testingOtp);
    setCopiedOtp(true);
    window.setTimeout(() => setCopiedOtp(false), 1800);
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const result = await verifyAdminOtp({
        deviceId: getOrCreateAdminDeviceId(),
        otp: otp.trim(),
        phoneNumber: phoneNumber.trim(),
        totpCode: totpCode.trim() || undefined,
      });
      await tokenStorage.setTokens(result.tokens);
      const profile = result.user;
      const nextSession = {
        activeSession: result.session,
        tokens: result.tokens,
        user: profile,
      };
      setAuthSession(nextSession);
      window.dispatchEvent(new Event(ADMIN_SESSION_REFRESHED_EVENT));
      window.location.assign('/admin/dashboard');
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'OTP verification failed. Please try again.',
      );
    }
  }

  return (
    <main className="auth-shell auth-shell-premium">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />
      <section className="auth-card auth-card-premium" aria-labelledby="admin-login-title">
        <div className="auth-brand-row">
          <div className="auth-brand-mark" aria-hidden="true">TS</div>
          <div>
            <p className="eyebrow">Tuljai Stays · Admin</p>
            <span className="auth-secure-label">Protected console</span>
          </div>
        </div>

        <div className="auth-heading">
          <h1 id="admin-login-title">Welcome back</h1>
          <p className="muted-copy">
            Sign in securely to manage lodges, bookings, reviews, revenue and platform operations.
          </p>
        </div>

        <div className="auth-security-strip" role="status">
          <span className="auth-status-dot" aria-hidden="true" />
          <span>Admin role verification is enforced before access.</span>
        </div>

        <form
          className="form-stack auth-form-premium"
          onSubmit={(event) => {
            if (otpRequested) {
              void handleVerifyOtp(event);
              return;
            }
            void handleRequestOtp(event);
          }}
        >
          <label className="form-field auth-field">
            <span>Admin phone number</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              placeholder="9876543210 or +919876543210"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </label>

          {otpRequested ? (
            <>
              {!IS_PRODUCTION_BUILD && testingOtp ? (
                <div className="dev-otp-card" role="status">
                  <div className="dev-otp-header">
                    <div>
                      <span className="dev-otp-badge">PREVIEW / DEVELOPMENT</span>
                      <strong>Development OTP</strong>
                    </div>
                    <span className="dev-otp-live">TEST MODE</span>
                  </div>
                  <div className="dev-otp-code-row">
                    <code aria-label="Development OTP">{testingOtp}</code>
                    <button className="dev-otp-action" type="button" onClick={useDevelopmentOtp}>
                      Use code
                    </button>
                    <button className="dev-otp-action" type="button" onClick={() => void copyDevelopmentOtp()}>
                      {copiedOtp ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p>This helper is available only in non-production builds. It is never rendered from a production build.</p>
                </div>
              ) : null}

              <label className="form-field auth-field">
                <span>OTP</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6 digit OTP"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/gu, '').slice(0, 6))}
                />
              </label>
              <label className="form-field auth-field">
                <span>Authenticator code <small>(only if 2FA is enabled)</small></span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 digit authenticator code"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, '').slice(0, 6))}
                />
              </label>
            </>
          ) : null}

          {auth.errorMessage || localError ? (
            <p className="error-banner" role="alert">{localError ?? auth.errorMessage}</p>
          ) : null}

          {expiresAt ? (
            <p className="auth-expiry">
              OTP expires at {new Date(expiresAt).toLocaleString('en-IN')}.
            </p>
          ) : null}

          <button className="button button-primary auth-submit" disabled={auth.isSubmitting} type="submit">
            {auth.isSubmitting ? 'Please wait…' : otpRequested ? 'Verify & open admin' : 'Send development OTP'}
          </button>

          {otpRequested ? (
            <button
              className="auth-back-button"
              type="button"
              onClick={() => {
                setOtpRequested(false);
                setOtp('');
                setTotpCode('');
                setTestingOtp(null);
                setExpiresAt(null);
                setLocalError(null);
              }}
            >
              ← Use a different phone number
            </button>
          ) : null}
        </form>

        <p className="auth-footer">Tuljapur operations · India · INR</p>
      </section>

      <style jsx global>{`
        .auth-shell-premium {
          background:
            radial-gradient(circle at 12% 18%, rgba(63, 138, 119, 0.24), transparent 32%),
            radial-gradient(circle at 88% 82%, rgba(209, 155, 32, 0.2), transparent 30%),
            linear-gradient(135deg, #071b16 0%, #103c32 48%, #173e36 100%);
          overflow: hidden;
          position: relative;
        }
        .auth-orb {
          border-radius: 999px;
          filter: blur(2px);
          opacity: 0.55;
          pointer-events: none;
          position: absolute;
        }
        .auth-orb-one {
          background: linear-gradient(135deg, #62d5b4, #d19b20);
          height: 260px;
          right: -90px;
          top: -90px;
          width: 260px;
        }
        .auth-orb-two {
          background: linear-gradient(135deg, #d19b20, #4fb596);
          bottom: -120px;
          height: 300px;
          left: -110px;
          width: 300px;
        }
        .auth-card-premium {
          backdrop-filter: blur(18px);
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 28px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.3);
          max-width: 560px;
          padding: 34px;
          position: relative;
          z-index: 1;
        }
        .auth-brand-row {
          align-items: center;
          display: flex;
          gap: 12px;
        }
        .auth-brand-mark {
          align-items: center;
          background: linear-gradient(135deg, #143b34, #3d8f79);
          border-radius: 14px;
          box-shadow: 0 10px 25px rgba(20, 59, 52, 0.25);
          color: #fff;
          display: flex;
          font-size: 0.85rem;
          font-weight: 900;
          height: 46px;
          justify-content: center;
          letter-spacing: 0.04em;
          width: 46px;
        }
        .auth-secure-label {
          color: #708078;
          display: block;
          font-size: 0.74rem;
          font-weight: 700;
          margin-top: 2px;
        }
        .auth-heading {
          margin-top: 28px;
        }
        .auth-heading h1 {
          font-size: clamp(2rem, 6vw, 2.7rem);
          letter-spacing: -0.04em;
          margin: 0 0 8px;
        }
        .auth-security-strip {
          align-items: center;
          background: linear-gradient(90deg, rgba(36, 91, 79, 0.09), rgba(209, 155, 32, 0.08));
          border: 1px solid rgba(36, 91, 79, 0.12);
          border-radius: 14px;
          color: #39534b;
          display: flex;
          font-size: 0.8rem;
          font-weight: 700;
          gap: 9px;
          margin: 22px 0;
          padding: 11px 13px;
        }
        .auth-status-dot {
          background: #168564;
          border-radius: 999px;
          box-shadow: 0 0 0 5px rgba(22, 133, 100, 0.12);
          height: 8px;
          width: 8px;
        }
        .auth-form-premium {
          gap: 15px;
        }
        .auth-field {
          gap: 7px;
        }
        .auth-field span {
          color: #263a34;
          font-size: 0.84rem;
          font-weight: 850;
        }
        .auth-field small {
          color: #718079;
          font-size: 0.72rem;
          font-weight: 650;
        }
        .auth-field input {
          background: #fbfdfc;
          border: 1px solid #d5dfda;
          border-radius: 13px;
          min-height: 50px;
          outline: none;
          padding: 12px 14px;
          transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          width: 100%;
        }
        .auth-field input:focus {
          border-color: #3c8c77;
          box-shadow: 0 0 0 4px rgba(60, 140, 119, 0.13);
          transform: translateY(-1px);
        }
        .dev-otp-card {
          background: linear-gradient(135deg, #0e3028 0%, #1c5a49 100%);
          border: 1px solid rgba(209, 155, 32, 0.45);
          border-radius: 18px;
          box-shadow: 0 16px 35px rgba(13, 48, 40, 0.2);
          color: #effaf6;
          padding: 16px;
        }
        .dev-otp-header,
        .dev-otp-code-row {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        .dev-otp-header strong {
          display: block;
          font-size: 0.95rem;
          margin-top: 5px;
        }
        .dev-otp-badge,
        .dev-otp-live {
          border-radius: 999px;
          display: inline-flex;
          font-size: 0.62rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          padding: 5px 8px;
        }
        .dev-otp-badge {
          background: rgba(209, 155, 32, 0.18);
          color: #ffe4a1;
        }
        .dev-otp-live {
          background: rgba(255, 255, 255, 0.1);
          color: #bfe9da;
        }
        .dev-otp-code-row {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 13px;
          margin-top: 13px;
          padding: 9px;
        }
        .dev-otp-code-row code {
          background: transparent;
          color: #fff;
          font-size: 1.55rem;
          font-weight: 900;
          letter-spacing: 0.22em;
          padding: 6px 4px 6px 8px;
        }
        .dev-otp-action {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 9px;
          color: #fff;
          cursor: pointer;
          font-size: 0.72rem;
          font-weight: 850;
          padding: 8px 10px;
        }
        .dev-otp-action:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .dev-otp-card p {
          color: #bfe1d6;
          font-size: 0.72rem;
          line-height: 1.45;
          margin-top: 10px;
        }
        .auth-submit {
          background: linear-gradient(135deg, #143b34, #2e8069) !important;
          border: 0 !important;
          border-radius: 13px !important;
          box-shadow: 0 12px 25px rgba(20, 59, 52, 0.22);
          min-height: 52px;
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }
        .auth-submit:hover:not(:disabled) {
          box-shadow: 0 16px 30px rgba(20, 59, 52, 0.28);
          transform: translateY(-1px);
        }
        .auth-submit:disabled {
          cursor: wait;
          opacity: 0.7;
        }
        .auth-expiry {
          color: #687770;
          font-size: 0.75rem;
        }
        .auth-back-button {
          background: transparent;
          border: 0;
          color: #3d695c;
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 800;
          padding: 4px;
        }
        .auth-back-button:hover {
          text-decoration: underline;
        }
        .auth-footer {
          color: #87938e;
          font-size: 0.7rem;
          margin-top: 24px;
          text-align: center;
        }
        @media (max-width: 560px) {
          .auth-card-premium { border-radius: 22px; padding: 24px 18px; }
          .dev-otp-code-row { align-items: stretch; flex-wrap: wrap; }
          .dev-otp-code-row code { flex: 1 1 100%; text-align: center; }
        }
      `}</style>
    </main>
  );
}
