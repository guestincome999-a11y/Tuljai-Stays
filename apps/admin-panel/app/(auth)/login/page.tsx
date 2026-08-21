'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import { getOrCreateAdminDeviceId } from '../../../src/auth/admin-device';
import { verifyAdminOtp } from '../../../src/auth/admin-auth-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { ADMIN_SESSION_REFRESHED_EVENT } from '../../../src/auth/admin-session-events';
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
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const result = await auth.requestOtp(phoneNumber.trim());
    if (result.success) {
      setOtpRequested(true);
      setExpiresAt(result.expiresAt);
      setTestingOtp(IS_PRODUCTION_BUILD ? null : result.otpForTesting ?? null);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const result = await verifyAdminOtp({ deviceId: getOrCreateAdminDeviceId(), otp: otp.trim(), phoneNumber: phoneNumber.trim(), totpCode: totpCode.trim() || undefined });
      await tokenStorage.setTokens(result.tokens);
      setAuthSession({ activeSession: result.session, tokens: result.tokens, user: result.user });
      window.dispatchEvent(new Event(ADMIN_SESSION_REFRESHED_EVENT));
      window.location.assign('/admin/dashboard');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'OTP verification failed. Please try again.');
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Tuljai Stays Admin</p>
        <h1>Secure admin login</h1>
        <p className="muted-copy">Login is restricted to admin roles. Owner and pilgrim accounts are blocked from this console.</p>
        <form className="form-stack" onSubmit={(event) => { if (otpRequested) { void handleVerifyOtp(event); return; } void handleRequestOtp(event); }}>
          <label className="form-field"><span>Admin phone number</span><input autoComplete="tel" inputMode="tel" placeholder="9876543210 or +919876543210" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
          {otpRequested ? <>
            <label className="form-field"><span>OTP</span><input autoComplete="one-time-code" inputMode="numeric" placeholder="6 digit code" value={otp} onChange={(event) => setOtp(event.target.value)} /></label>
            <label className="form-field"><span>Authenticator code (if 2FA is enabled)</span><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="6 digit authenticator code" value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, ''))} /></label>
          </> : null}
          {auth.errorMessage || localError ? <p className="error-banner">{localError ?? auth.errorMessage}</p> : null}
          {expiresAt ? <p className="muted-copy">OTP expires at {new Date(expiresAt).toLocaleString('en-IN')}.</p> : null}
          {!IS_PRODUCTION_BUILD && testingOtp ? <p className="dev-otp">Development OTP: {testingOtp}</p> : null}
          <button className="button button-primary" disabled={auth.isSubmitting} type="submit">{otpRequested ? 'Verify OTP' : 'Send OTP'}</button>
        </form>
      </section>
    </main>
  );
}
