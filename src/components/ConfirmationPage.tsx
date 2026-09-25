import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, ShieldCheck, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { DashboardTheme } from '../types';

interface ConfirmationPageProps {
  token: string;
  initialAction?: string;
  theme: DashboardTheme;
  onReturnToDashboard: () => void;
}

interface VerifyData {
  valid: boolean;
  taskDate?: string;
  taskName?: string;
  requestedAction?: 'completed' | 'not_completed';
  currentStatus?: boolean;
  expiresAt?: string;
  error?: string;
}

export const ConfirmationPage: React.FC<ConfirmationPageProps> = ({
  token,
  initialAction,
  theme,
  onReturnToDashboard,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null);
  const [selectedAction, setSelectedAction] = useState<'completed' | 'not_completed'>(
    initialAction === 'completed' ? 'completed' : 'not_completed'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isDark = theme === 'dark' || true; // Modern sleek dark aesthetic matching System Builder

  useEffect(() => {
    async function verify() {
      try {
        setLoading(true);
        const res = await fetch(`/api/confirm/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok && data.valid) {
          setVerifyData(data);
          if (data.requestedAction) {
            setSelectedAction(data.requestedAction);
          }
        } else {
          setVerifyData({ valid: false, error: data.error || 'Invalid confirmation link' });
        }
      } catch (err: any) {
        setVerifyData({ valid: false, error: err.message || 'Verification connection failed' });
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [token]);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const res = await fetch('/api/confirm/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: selectedAction,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitSuccess(true);
        setSuccessMessage(data.message || 'Status updated successfully!');
      } else {
        setErrorMessage(data.error || 'Failed to submit confirmation.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-2 sm:p-3 select-none font-sans">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center space-x-1.5">
            <div className="w-9 h-9 bg-amber-400 rounded-lg flex items-center justify-center text-slate-950 font-black text-sm tracking-tight shadow-md">
              RA
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">System Builder</h1>
              <p className="text-xs text-slate-400">Daily Commitment Confirmation</p>
            </div>
          </div>
          <button
            onClick={onReturnToDashboard}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-1.5 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tracker</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-6 flex flex-col items-center justify-center space-y-1.5">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <p className="text-sm text-slate-400">Verifying secure confirmation token...</p>
          </div>
        )}

        {/* Invalid Token State */}
        {!loading && verifyData && !verifyData.valid && (
          <div className="space-y-3">
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-1.5 text-rose-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Invalid or Expired Link</p>
                <p className="text-xs mt-0.5 text-rose-400/90 leading-relaxed">
                  {verifyData.error || 'This link has expired or has already been used.'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              To update your task status directly, please return to your main tracker dashboard.
            </p>

            <button
              onClick={onReturnToDashboard}
              className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-sm transition shadow-md"
            >
              Open Daily Tracker
            </button>
          </div>
        )}

        {/* Success State */}
        {!loading && submitSuccess && (
          <div className="space-y-3 text-center py-2">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">Confirmation Recorded!</h2>
              <p className="text-sm text-slate-300 mt-1">
                {successMessage}
              </p>
            </div>

            <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800 text-left space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Date:</span>
                <span className="font-mono text-slate-200 font-bold">{verifyData?.taskDate}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>New Status:</span>
                <span className={`font-bold ${selectedAction === 'completed' ? 'text-blue-400' : 'text-amber-400'}`}>
                  {selectedAction === 'completed' ? '✓ Task Completed' : '✕ Not Completed'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Database Sync:</span>
                <span className="text-blue-400 font-mono">Synced to Cloud Firestore</span>
              </div>
            </div>

            <button
              onClick={onReturnToDashboard}
              className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-sm transition shadow-md cursor-pointer"
            >
              Return to Daily Tracker
            </button>
          </div>
        )}

        {/* Active Confirmation Form (Requires user click to prevent email scanner side effects) */}
        {!loading && verifyData && verifyData.valid && !submitSuccess && (
          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-md border border-teal-500/20">
                Daily Commitment Review
              </span>
              <h2 className="text-lg font-bold text-white mt-1">
                Confirm your task status for {verifyData.taskDate}
              </h2>
            </div>

            {/* Task Info Box */}
            <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Today’s Task
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {verifyData.taskName || 'Daily Commitment'}
              </div>
              <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Current Website Status:</span>
                <span className={`font-bold ${verifyData.currentStatus ? 'text-blue-400' : 'text-slate-400'}`}>
                  {verifyData.currentStatus ? 'Completed (Checked)' : 'Pending (Unchecked)'}
                </span>
              </div>
            </div>

            {/* Action Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Select Final Status to Record:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedAction('completed')}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                    selectedAction === 'completed'
                      ? 'bg-teal-600/20 border-teal-500 text-teal-300 ring-2 ring-teal-500/30 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className={`w-5 h-5 ${selectedAction === 'completed' ? 'text-teal-400' : 'text-slate-500'}`} />
                  <span className="text-xs">Completed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAction('not_completed')}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                    selectedAction === 'not_completed'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <XCircle className={`w-5 h-5 ${selectedAction === 'not_completed' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="text-xs">Not Completed</span>
                </button>
              </div>
            </div>

            {/* Scanner Protection Notice */}
            <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex items-start space-x-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Clicking the button below records this response in the database. Automated email scanners opening this link have not changed your task.
              </p>
            </div>

            {errorMessage && (
              <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              id="btn-submit-task-confirmation"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition shadow-lg flex items-center justify-center space-x-1 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <span>Confirm {selectedAction === 'completed' ? 'Task Completed' : 'Not Completed'}</span>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
