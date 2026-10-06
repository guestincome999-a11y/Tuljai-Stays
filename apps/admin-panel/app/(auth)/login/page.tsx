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
const ADMIN_PREVIEW_MODE = process.env.NEXT_PUBLIC_ADMIN_PREVIEW_MODE === 'true';
const SHOW_TEST_OTP = !IS_PRODUCTION_BUILD || ADMIN_PREVIEW_MODE;

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
      setTestingOtp(SHOW_TEST_OTP ? (result.otpForTesting ?? null) : null);
    }
  }

  function useDevelopmentOtp() {
    if (!testingOtp || !SHOW_TEST_OTP) return;
    setOtp(testingOtp);
    setLocalError(null);
  }

  async function copyDevelopmentOtp() {
    if (!testingOtp || !SHOW_TEST_OTP || !navigator.clipboard) return;
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
              {SHOW_TEST_OTP && testingOtp ? (
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
                  <p>This helper is enabled only when the admin preview mode is explicitly configured. Remove the preview flag before real production launch.</p>
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
            {auth.isSubmitting ? 'Please wait…' : otpRequested ? 'Verify & open admin' : 'Send preview OTP'}
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
          background: linear-gradient(135deg, #eef4ff 0%, #f5f7fb 45%, #fff1e6 100%);
          overflow: hidden;
          position: relative;
        }
        .auth-orb {
          display: none;
        }
        .auth-card-premium {
          background: #ffffff;
          border: 1px solid var(--color-outline);
          border-radius: 20px;
          box-shadow: 0 18px 50px rgba(15, 31, 61, 0.1);
          max-width: 520px;
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
          background: var(--color-navy);
          border-radius: 12px;
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
          color: var(--color-muted);
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
          background: var(--color-primary-soft);
          border: 1px solid #d3e1ff;
          border-radius: 14px;
          color: var(--color-primary-strong);
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
          color: var(--color-text);
          font-size: 0.84rem;
          font-weight: 850;
        }
        .auth-field small {
          color: var(--color-muted);
          font-size: 0.72rem;
          font-weight: 650;
        }
        .auth-field input {
          background: var(--color-surface-subtle);
          border: 1px solid var(--color-outline);
          border-radius: 13px;
          min-height: 50px;
          outline: none;
          padding: 12px 14px;
          transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          width: 100%;
        }
        .auth-field input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
          transform: translateY(-1px);
        }
        .dev-otp-card {
          background: var(--color-primary-soft);
          border: 1px solid #d3e1ff;
          border-radius: 16px;
          color: var(--color-primary-strong);
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
          background: #dbe7ff;
          color: #1d4fd1;
        }
        .dev-otp-live {
          background: #e3f6ec;
          color: #0d7a54;
        }
        .dev-otp-code-row {
          background: #ffffff;
          border: 1px solid #d3e1ff;
          border-radius: 13px;
          margin-top: 13px;
          padding: 9px;
        }
        .dev-otp-code-row code {
          background: transparent;
          color: var(--color-primary-strong);
          font-size: 1.55rem;
          font-weight: 900;
          letter-spacing: 0.22em;
          padding: 6px 4px 6px 8px;
        }
        .dev-otp-action {
          background: #ffffff;
          border: 1px solid #d3e1ff;
          border-radius: 9px;
          color: var(--color-primary-strong);
          cursor: pointer;
          font-size: 0.72rem;
          font-weight: 850;
          padding: 8px 10px;
        }
        .dev-otp-action:hover {
          background: var(--color-primary-soft);
        }
        .dev-otp-card p {
          color: var(--color-muted);
          font-size: 0.72rem;
          line-height: 1.45;
          margin-top: 10px;
        }
        .auth-submit {
          background: var(--gradient-primary) !important;
          border: 0 !important;
          border-radius: 13px !important;
          box-shadow: 0 10px 22px rgba(11, 42, 91, 0.22);
          min-height: 52px;
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }
        .auth-submit:hover:not(:disabled) {
          box-shadow: 0 14px 28px rgba(11, 42, 91, 0.28);
          transform: translateY(-1px);
        }
        .auth-submit:disabled {
          cursor: wait;
          opacity: 0.7;
        }
        .auth-expiry {
          color: var(--color-muted);
          font-size: 0.75rem;
        }
        .auth-back-button {
          background: transparent;
          border: 0;
          color: var(--color-primary);
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 800;
          padding: 4px;
        }
        .auth-back-button:hover {
          text-decoration: underline;
        }
        .auth-footer {
          color: var(--color-muted);
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
