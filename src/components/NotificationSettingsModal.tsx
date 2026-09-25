import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Bell,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { DashboardTheme } from '../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: DashboardTheme;
}

interface SettingsState {
  enabled: boolean;
  recipientEmail: string;
  recipientName: string;
  scheduledTime: string;
  timezone: string;
  lastSentDate?: string;
}

interface ProviderState {
  isConfigured: boolean;
  provider: 'smtp' | 'none';
  fromEmail: string;
  smtpConfigured: boolean;
  smtpDetails?: {
    hostSet: boolean;
    userSet: boolean;
    passSet: boolean;
    port: number;
    hostName?: string;
  };
}

interface DeliveryLog {
  id: string;
  recipient: string;
  subject: string;
  date: string;
  taskTitle?: string;
  status: string;
  provider?: string;
  error?: string;
  sentAt: string;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'logs'>('settings');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [settings, setSettings] = useState<SettingsState>({
    enabled: true,
    recipientEmail: 'sbrafiqahmedali7575@gmail.com',
    recipientName: 'Rafiq Ahmed',
    scheduledTime: '21:00',
    timezone: 'Asia/Kolkata',
  });

  const [provider, setProvider] = useState<ProviderState>({
    isConfigured: false,
    provider: 'none',
    fromEmail: '',
    smtpConfigured: false,
  });

  const [currentKolkataTime, setCurrentKolkataTime] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications/settings');
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setProvider(data.provider);
        setCurrentKolkataTime(data.currentKolkataTime || data.kolkataTime?.timeStr || '');
      }
    } catch (e) {
      console.error('Failed to load notification settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch('/api/notifications/logs');
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('Failed to load delivery logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch('/api/notifications/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTestResult(data);
      fetchLogs();
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-2.5 bg-black/70 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-1.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Daily Email Task Confirmation</h2>
              <p className="text-xs text-slate-400">Automated 09:00 PM IST Task Status Check</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-0.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-3 pt-1">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-1.5 px-1.5 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Schedule & Settings
          </button>
          <button
            onClick={() => {
              setActiveTab('logs');
              fetchLogs();
            }}
            className={`pb-1.5 px-1.5 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Delivery Audit Logs ({logs.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-slate-200 text-xs">
          
          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-1.5">
              <Loader2 className="w-7 h-7 text-teal-400 animate-spin" />
              <p className="text-slate-400">Loading notification configuration...</p>
            </div>
          ) : activeTab === 'settings' ? (
            <>
              {/* Provider Connection Status Card */}
              <div
                className={`p-2 rounded-xl border ${
                  provider.isConfigured
                    ? 'bg-blue-950/30 border-blue-500/30 text-blue-300'
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-start space-x-1.5">
                  {provider.isConfigured ? (
                    <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-sm">
                        {provider.isConfigured
                          ? `Email Provider Connected (${provider.provider.toUpperCase()})`
                          : 'Email Delivery Setup: Key Configuration'}
                      </span>
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          provider.isConfigured
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {provider.isConfigured ? 'Active' : 'Awaiting Server Key'}
                      </span>
                    </div>

                    {provider.isConfigured ? (
                      <div className="space-y-0.5 mt-0.5">
                        <p className="text-xs text-blue-300/90 leading-relaxed">
                          Ready to deliver live emails to <span className="font-bold text-white">{settings.recipientEmail}</span>.
                        </p>
                        <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[11px] font-mono text-blue-200/80">
                          <span className="bg-blue-950/60 px-1 py-0.5 rounded border border-blue-500/20">
                            Protocol: Gmail SMTP (Port 587 • STARTTLS)
                          </span>
                          {provider.smtpDetails?.hostName && (
                            <span className="bg-blue-950/60 px-1 py-0.5 rounded border border-blue-500/20">
                              Host: {provider.smtpDetails.hostName}:{provider.smtpDetails.port || 587}
                            </span>
                          )}
                          <span className="bg-blue-950/60 px-1 py-0.5 rounded border border-blue-500/20">
                            From: {provider.fromEmail}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 mt-0.5">
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          Expiring cryptographic token security, landing page verification, and Firestore synchronization are <strong>100% active and running</strong>. To deliver directly to your Gmail inbox via <strong>Gmail SMTP (Port 587 STARTTLS)</strong>:
                        </p>
                        
                        {/* Gmail SMTP Configuration Details */}
                        <div className="p-1.5 bg-black/50 rounded-lg border border-amber-500/20 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-amber-200">
                              Gmail SMTP Setup (Port 587 with STARTTLS)
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Never exposed to browser
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-300">
                            Add these environment secrets in the AI Studio Settings menu:
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[11px]">
                            <div className="flex items-center justify-between p-1 bg-slate-900 rounded border border-slate-800">
                              <span className="text-teal-300 font-bold">SMTP_HOST</span>
                              <span className={`text-[10px] px-1 py-0.2 rounded font-sans ${provider.smtpDetails?.hostSet ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>
                                {provider.smtpDetails?.hostSet ? '✓ Set' : 'Required (smtp.gmail.com)'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-1 bg-slate-900 rounded border border-slate-800">
                              <span className="text-teal-300 font-bold">SMTP_PORT</span>
                              <span className="text-[10px] px-1 py-0.2 rounded font-sans bg-slate-800 text-slate-400">
                                {provider.smtpDetails?.port || 587} (Port 587 STARTTLS)
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-1 bg-slate-900 rounded border border-slate-800">
                              <span className="text-teal-300 font-bold">SMTP_USER</span>
                              <span className={`text-[10px] px-1 py-0.2 rounded font-sans ${provider.smtpDetails?.userSet ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>
                                {provider.smtpDetails?.userSet ? '✓ Set' : 'Required (Gmail address)'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-1 bg-slate-900 rounded border border-slate-800">
                              <span className="text-teal-300 font-bold">SMTP_PASS</span>
                              <span className={`text-[10px] px-1 py-0.2 rounded font-sans ${provider.smtpDetails?.passSet ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>
                                {provider.smtpDetails?.passSet ? '✓ Set' : 'Required (App Password)'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* External Cloud Scheduler Architecture Card */}
              <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <h3 className="font-bold text-white text-sm">Automated &amp; Cloud Scheduler Architecture</h3>
                  </div>
                  <span className="text-[10px] font-mono bg-teal-950 text-teal-300 border border-teal-800/60 px-1 py-0.5 rounded font-bold">
                    POST /api/send-daily-reminder
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The server now includes an <strong>internal background runner</strong> that automatically checks Asia/Kolkata time every 30 seconds and dispatches your daily reminder at <strong>09:00 PM IST</strong>. For 100% reliability when the container sleeps, you can also connect an external cron (e.g. cron-job.org or Google Cloud Scheduler).
                </p>
                <div className="bg-slate-900/90 rounded-lg p-1.5 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500 font-sans">
                    External Webhook Trigger (cron-job.org / Cloud Scheduler):
                  </div>
                  <div className="overflow-x-auto select-all text-teal-300 bg-black/40 p-1 rounded border border-slate-800/80 break-all">
                    curl -X POST {typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-vvkki5ofvlos77ccgutcla-146310585503.asia-east1.run.app'}/api/send-daily-reminder \<br />
                    &nbsp;&nbsp;-H "Authorization: Bearer commit-daily-scheduler-secret-auth-key-2026"
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans pt-0.5">
                    <span>• Timezone: <strong className="text-slate-200">Asia/Kolkata (IST)</strong></span>
                    <span>• Auto In-Server Runner: <strong className="text-blue-400">Active</strong></span>
                  </div>
                </div>
              </div>

              {/* Main Settings Form */}
              <div className="space-y-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                
                {/* Enable Switch */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <div>
                    <label className="font-bold text-sm text-white block">
                      Daily Confirmation Emails
                    </label>
                    <p className="text-slate-400 text-xs">
                      Dispatched daily at 09:00 PM IST via external scheduler
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      settings.enabled ? 'bg-teal-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Recipient details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-slate-400 font-bold mb-0.5">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={settings.recipientName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, recipientName: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-medium focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-0.5">
                      Recipient Email (Gmail)
                    </label>
                    <input
                      type="email"
                      value={settings.recipientEmail}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, recipientEmail: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-medium focus:border-teal-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Delivery Time & Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  <div>
                    <label className="block text-slate-400 font-bold mb-0.5 flex items-center justify-between">
                      <span>Scheduled Delivery Time</span>
                      <span className="text-teal-400 text-[11px] font-mono">
                        IST Time: {currentKolkataTime || '22:00'}
                      </span>
                    </label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="time"
                        value={settings.scheduledTime}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, scheduledTime: e.target.value }))
                        }
                        className="bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-sm focus:border-teal-500 focus:outline-hidden w-full"
                      />
                      <span className="text-slate-400 font-bold text-xs">IST</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-0.5">
                      Configured Timezone
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`${settings.timezone} (India Standard Time)`}
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-1.5 py-1 text-slate-300 font-mono text-xs cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Save and feedback */}
                <div className="pt-1 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {saveSuccess && (
                      <span className="text-blue-400 flex items-center space-x-0.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settings saved to Cloud Firestore!</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-2 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Schedule</span>
                  </button>
                </div>
              </div>

              {/* Admin Test Confirmation Email Action */}
              <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.5 rounded">
                        Admin Action
                      </span>
                      <h3 className="font-bold text-white text-sm">Verify Gmail SMTP Immediately</h3>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Sends an instant live commitment email to {settings.recipientEmail} to test credentials and links.
                    </p>
                  </div>
                  <button
                    id="btn-send-test-email"
                    onClick={handleSendTest}
                    disabled={testing}
                    className="px-2 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-md active:scale-95"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending to Gmail...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Test Email</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Test Result Display */}
                {testResult && (
                  <div className="mt-1.5 p-2 rounded-lg border bg-slate-900 border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">SMTP Verification Result:</span>
                      <span
                        className={`font-bold px-1 py-0.5 rounded-full text-[10px] uppercase ${
                          testResult.success && testResult.status !== 'failed'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {testResult.status || (testResult.success ? 'Delivered' : 'Failed')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Recipient:</span>
                        <span className="font-mono text-white font-bold">{testResult.recipient || settings.recipientEmail}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Date & Task:</span>
                        <span className="text-slate-200">{testResult.date || 'Today'} • {testResult.taskName || 'Daily Commitment'}</span>
                      </div>
                    </div>

                    {testResult.messageId && (
                      <div className="text-xs text-slate-300 font-mono bg-black/40 p-1 rounded border border-slate-800">
                        <span className="text-slate-500">Provider Message ID: </span>
                        <span className="text-teal-300">{testResult.messageId}</span>
                      </div>
                    )}

                    {testResult.error && (
                      <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-1.5 rounded">
                        <strong>Error: </strong>
                        <span>{testResult.error}</span>
                      </div>
                    )}

                    {testResult.previewLinks && (
                      <div className="pt-1 border-t border-slate-800 space-y-1">
                        <div className="text-[11px] font-bold text-teal-400 flex items-center gap-0.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Generated Cryptographic Confirmation Links (Click to test):</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <a
                            href={testResult.previewLinks.completedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded bg-teal-950/40 border border-teal-800/60 hover:border-teal-400 text-teal-300 font-bold text-center block transition text-[11px]"
                          >
                            ✓ Test: Mark Completed Link
                          </a>
                          <a
                            href={testResult.previewLinks.notCompletedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded bg-slate-800/60 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold text-center block transition text-[11px]"
                          >
                            ✕ Test: Mark Not Completed Link
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Delivery Audit Logs View */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">
                  Automated checks and confirmation dispatch history
                </span>
                <button
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="flex items-center space-x-0.5 text-teal-400 hover:text-teal-300 font-bold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="py-6 text-center text-slate-500">
                  No delivery logs recorded yet. Use &quot;Send Test Email&quot; to test.
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-1.5 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center space-x-1">
                          <span
                            className={`font-bold px-1 py-0.5 rounded-full text-[10px] uppercase ${
                              log.status === 'delivered'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : log.status === 'skipped'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : log.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="font-bold text-white truncate">{log.subject}</span>
                        </div>
                        <div className="text-slate-400 flex items-center space-x-1.5 text-[11px]">
                          <span>Date: <span className="text-slate-300">{log.date}</span></span>
                          <span>•</span>
                          <span>Recipient: <span className="text-slate-300 font-mono">{log.recipient}</span></span>
                        </div>
                        {log.error && (
                          <div className="text-amber-400/90 text-[11px] pt-0.5">
                            Note: {log.error}
                          </div>
                        )}
                      </div>

                      <div className="text-right text-[11px] text-slate-500 whitespace-nowrap font-mono">
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-slate-500 text-xs">
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>Timezone: Asia/Kolkata (IST)</span>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
