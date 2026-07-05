'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';

export default function AdminLoginPage() {
  const auth = useAdminAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [testingOtp, setTestingOtp] = useState<string | null>(null);

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await auth.requestOtp(phoneNumber.trim());

    if (result.success) {
      setOtpRequested(true);
      setExpiresAt(result.expiresAt);
      setTestingOtp(result.otpForTesting ?? null);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await auth.verifyOtp({ otp: otp.trim(), phoneNumber: phoneNumber.trim() });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Tuljai Stays Admin</p>
        <h1>Secure admin login</h1>
        <p className="muted-copy">
          Login is restricted to admin roles. Owner and pilgrim accounts are blocked from this
          console.
        </p>

        <form
          className="form-stack"
          onSubmit={(event) => {
            if (otpRequested) {
              void handleVerifyOtp(event);
              return;
            }

            void handleRequestOtp(event);
          }}
        >
          <label className="form-field">
            <span>Admin phone number</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              placeholder="+919999999999"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </label>

          {otpRequested ? (
            <label className="form-field">
              <span>OTP</span>
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="6 digit code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
              />
            </label>
          ) : null}

          {auth.errorMessage ? <p className="error-banner">{auth.errorMessage}</p> : null}

          {expiresAt ? (
            <p className="muted-copy">
              OTP expires at {new Date(expiresAt).toLocaleString('en-IN')}.
            </p>
          ) : null}

          {testingOtp ? <p className="dev-otp">Development OTP: {testingOtp}</p> : null}

          <button className="button button-primary" disabled={auth.isSubmitting} type="submit">
            {otpRequested ? 'Verify OTP' : 'Send OTP'}
          </button>
        </form>
      </section>
    </main>
  );
}
