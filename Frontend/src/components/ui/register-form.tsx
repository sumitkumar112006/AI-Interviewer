"use client";
import React, { useState } from "react";
import { User, Lock, KeyRound, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import './login-form.scss';

export interface RegisterFormProps {
  username?: string;
  setUsername?: (val: string) => void;
  email?: string;
  setEmail?: (val: string) => void;
  password?: string;
  setPassword?: (val: string) => void;
  confirmPassword?: string;
  setConfirmPassword?: (val: string) => void;
  agreedToTerms?: boolean;
  setAgreedToTerms?: (val: boolean) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onGoogleSignUp?: () => void;
  onSignIn?: () => void;
  error?: string;
  infoMessage?: string;
  loading?: boolean;
}

export function RegisterForm({
  username: externalUsername,
  setUsername: externalSetUsername,
  email: externalEmail,
  setEmail: externalSetEmail,
  password: externalPassword,
  setPassword: externalSetPassword,
  confirmPassword: externalConfirmPassword,
  setConfirmPassword: externalSetConfirmPassword,
  agreedToTerms: externalAgreedToTerms,
  setAgreedToTerms: externalSetAgreedToTerms,
  onSubmit: externalOnSubmit,
  onGoogleSignUp,
  onSignIn,
  error,
  infoMessage,
  loading = false,
}: RegisterFormProps = {}) {
  const [localUsername, setLocalUsername] = useState("");
  const [localEmail, setLocalEmail] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [localConfirmPassword, setLocalConfirmPassword] = useState("");
  const [localAgreedToTerms, setLocalAgreedToTerms] = useState(false);

  const username = externalUsername !== undefined ? externalUsername : localUsername;
  const setUsername = externalSetUsername || setLocalUsername;

  const email = externalEmail !== undefined ? externalEmail : localEmail;
  const setEmail = externalSetEmail || setLocalEmail;

  const password = externalPassword !== undefined ? externalPassword : localPassword;
  const setPassword = externalSetPassword || setLocalPassword;

  const confirmPassword = externalConfirmPassword !== undefined ? externalConfirmPassword : localConfirmPassword;
  const setConfirmPassword = externalSetConfirmPassword || setLocalConfirmPassword;

  const agreedToTerms = externalAgreedToTerms !== undefined ? externalAgreedToTerms : localAgreedToTerms;
  const setAgreedToTerms = externalSetAgreedToTerms || setLocalAgreedToTerms;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (externalOnSubmit) {
      externalOnSubmit(e);
    }
  };

  return (
    <div className="login-card-container w-full max-w-[420px] p-8 space-y-5 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl relative z-20">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight">Create Account</h2>
        <p className="mt-1.5 text-xs text-gray-300">Join KIVI-AI to build your career</p>
      </div>

      {infoMessage && (
        <div className="p-3 text-xs rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="p-3 text-xs rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="register-form-fields" onSubmit={handleSubmit}>
        {/* 4 Inputs stacked with clean uniform spacing */}
        <div className="register-inputs-stack">
          {/* Full Name */}
          <div className="login-input-group relative">
            <User className="input-icon" size={18} />
            <input
              type="text"
              id="reg_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="glass-input-field"
              placeholder="Full name"
              autoComplete="name"
              required
              disabled={loading}
            />
          </div>

          {/* Email Address */}
          <div className="login-input-group relative">
            <Mail className="input-icon" size={18} />
            <input
              type="email"
              id="reg_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input-field"
              placeholder="Email address"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="login-input-group relative">
            <Lock className="input-icon" size={18} />
            <input
              type="password"
              id="reg_password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input-field"
              placeholder="Password (min 6 characters)"
              autoComplete="new-password"
              required
              disabled={loading}
            />
          </div>

          {/* Confirm Password */}
          <div className="login-input-group relative">
            <KeyRound className="input-icon" size={18} />
            <input
              type="password"
              id="reg_confirm_password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input-field"
              placeholder="Confirm password"
              autoComplete="new-password"
              required
              disabled={loading}
            />
          </div>
        </div>

        {/* Terms of Service & Privacy Policy Checkbox */}
        <div className="auth-checkbox-group">
          <input
            id="reg_terms_checkbox"
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            required
            disabled={loading}
          />
          <label htmlFor="reg_terms_checkbox" className="auth-checkbox-label">
            I agree to the{' '}
            <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer" className="terms-link">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className="terms-link">
              Privacy Policy
            </Link>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="group w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all duration-300 disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Account...
            </span>
          ) : (
            <>
              Create Account
              <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="auth-divider">
          <div className="divider-line"></div>
          <span className="divider-text">OR CONTINUE WITH</span>
          <div className="divider-line"></div>
        </div>

        {/* Google Sign-Up Button */}
        <button
          type="button"
          onClick={onGoogleSignUp}
          disabled={loading}
          className="google-login-btn"
          aria-label="Sign up with Google"
        >
          <svg
            className="google-icon"
            width={20}
            height={20}
            viewBox="0 0 48 48"
            style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', maxWidth: '20px', maxHeight: '20px', flexShrink: 0 }}
          >
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"></path>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"></path>
            <path fill="#4CAF50" d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"></path>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"></path>
          </svg>
          <span className="google-text">Sign up with Google</span>
        </button>
      </form>

      <p className="auth-footer-text">
        Already have an account?{" "}
        <a
          href={onSignIn ? "#" : "/login"}
          onClick={(e) => {
            if (onSignIn) {
              e.preventDefault();
              onSignIn();
            }
          }}
          className="font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
        >
          Sign In
        </a>
      </p>
    </div>
  );
}

export default RegisterForm;
