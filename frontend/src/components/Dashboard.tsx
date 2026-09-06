import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Clock, Send, ChevronDown, Filter, RefreshCcw, Star, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

interface Email {
    id: string;
    sender_email: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    scheduled_at: string;
    sent_at?: string;
    preview_url?: string;
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, logout, updateSlackStatus } = useAuth();
    const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
    const [scheduledMails, setScheduledMails] = useState<Email[]>([]);
    const [sentMails, setSentMails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [slackLoading, setSlackLoading] = useState(false);
    const [slackMessage, setSlackMessage] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Handle Slack OAuth callback params
    useEffect(() => {
        const slackStatus = searchParams.get('slack');
        const channel = searchParams.get('channel');
        if (slackStatus === 'connected') {
            updateSlackStatus(true, channel || undefined);
            setSlackMessage(`✅ Slack connected${channel ? ` to #${channel.replace('#', '')}` : ''}!`);
            setTimeout(() => setSlackMessage(''), 5000);
        } else if (slackStatus === 'error') {
            const reason = searchParams.get('reason');
            setSlackMessage(`❌ Slack connection failed: ${reason || 'unknown error'}`);
            setTimeout(() => setSlackMessage(''), 5000);
        }
    }, [searchParams, updateSlackStatus]);

    const fetchMails = useCallback(async () => {
        setLoading(true);
        try {
            if (searchQuery.trim()) {
                const res = await api.get(`/emails/search?q=${encodeURIComponent(searchQuery)}`);
                const all: Email[] = res.data;
                setScheduledMails(all.filter(m => m.status === 'scheduled'));
                setSentMails(all.filter(m => m.status === 'sent' || m.status === 'failed'));
            } else {
                const [scheduledRes, sentRes] = await Promise.all([
                    api.get('/emails/scheduled'),
                    api.get('/emails/sent'),
                ]);
                setScheduledMails(scheduledRes.data);
                setSentMails(sentRes.data);
            }
        } catch (error) {
            console.error('Failed to fetch mails', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        fetchMails();
    }, [fetchMails]);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        const interval = setInterval(fetchMails, 15000);
        return () => clearInterval(interval);
    }, [fetchMails]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSlackConnect = () => {
        if (!user?.google_id) return;
        setSlackLoading(true);
        // Open Slack OAuth in the same window (redirect flow)
        window.location.href = `http://localhost:3001/api/auth/slack?google_id=${user.google_id}`;
    };

    const displayMails = activeTab === 'scheduled' ? scheduledMails : sentMails;

    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    const statusBadge = (status: string) => {
        if (status === 'sent') return <span className="text-[11px] bg-[#E5F5EC] text-[#00A859] px-2 py-0.5 rounded-md font-bold">Sent</span>;
        if (status === 'failed') return <span className="text-[11px] bg-red-50 text-red-500 px-2 py-0.5 rounded-md font-bold">Failed</span>;
        return <span className="text-[11px] bg-[#FFF3E0] text-[#E65100] px-2 py-0.5 rounded-md font-bold">Scheduled</span>;
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {/* ── Sidebar ── */}
            <aside className="w-64 border-r border-gray-100 flex flex-col pt-6 bg-white shrink-0">
                {/* Logo */}
                <div className="px-6 mb-6 font-black text-[28px] tracking-tighter text-black">ONG</div>

                {/* User Profile */}
                <div className="px-4 mb-4">
                    <div
                        className="flex items-center gap-3 bg-[#F9FAFB] rounded-xl p-2.5 cursor-pointer border border-transparent hover:border-gray-200 transition-all relative"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-[#00A859] flex items-center justify-center text-white font-bold text-base">
                                {user?.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                            <h3 className="text-[13px] font-semibold text-gray-800 leading-none truncate">{user?.name || 'User'}</h3>
                            <p className="text-[11px] text-gray-500 truncate mt-0.5">{user?.email || ''}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />

                        {/* Dropdown */}
                        {showUserMenu && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Compose Button */}
                <div className="px-4 mb-6">
                    <button
                        id="compose-btn"
                        onClick={() => navigate('/compose')}
                        className="w-full flex items-center justify-center py-2.5 border border-[#00A859] text-[#00A859] rounded-full font-semibold text-[13px] hover:bg-[#E5F5EC] transition-colors"
                    >
                        Compose
                    </button>
                </div>

                {/* Nav */}
                <div className="px-4 flex-1">
                    <p className="text-[10px] text-gray-400 font-bold mb-3 tracking-wider px-2">CORE</p>
                    <ul className="space-y-1">
                        <li>
                            <button
                                id="tab-scheduled"
                                onClick={() => setActiveTab('scheduled')}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'scheduled' ? 'bg-[#E5F5EC] text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <span className="text-[13px]">Scheduled</span>
                                </div>
                                <span className="text-xs text-gray-400 tabular-nums">{scheduledMails.length}</span>
                            </button>
                        </li>
                        <li>
                            <button
                                id="tab-sent"
                                onClick={() => setActiveTab('sent')}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'sent' ? 'bg-[#E5F5EC] text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Send className="w-4 h-4 text-gray-500" />
                                    <span className="text-[13px]">Sent</span>
                                </div>
                                <span className="text-xs text-gray-400 tabular-nums">{sentMails.length}</span>
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Slack Connect Section */}
                <div className="px-4 pb-6 mt-4 border-t border-gray-100 pt-4">
                    <p className="text-[10px] text-gray-400 font-bold mb-3 tracking-wider px-2">INTEGRATIONS</p>
                    {user?.slack_connected ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#E5F5EC]">
                            <Zap className="w-4 h-4 text-[#00A859]" />
                            <div>
                                <p className="text-[12px] font-semibold text-[#00A859]">Slack Connected</p>
                                {user.slack_channel && (
                                    <p className="text-[10px] text-gray-400">{user.slack_channel}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            id="slack-connect-btn"
                            onClick={handleSlackConnect}
                            disabled={slackLoading}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                            </svg>
                            Connect Slack
                        </button>
                    )}
                    {slackMessage && (
                        <p className={`mt-2 text-xs text-center ${slackMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                            {slackMessage}
                        </p>
                    )}
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 flex flex-col bg-white overflow-hidden">
                {/* Header */}
                <header className="h-16 flex items-center justify-between px-8 border-b border-gray-100 shrink-0">
                    <div className="flex-1 max-w-2xl">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-gray-400" />
                            <input
                                id="search-input"
                                type="text"
                                placeholder="Search emails..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#F6F7F9] rounded-full py-2 pl-10 pr-4 text-sm border border-transparent focus:border-gray-200 focus:ring-0 outline-none text-gray-700 placeholder-gray-400"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 ml-4">
                        <button className="p-2 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            <Filter className="w-4 h-4" />
                        </button>
                        <button
                            id="refresh-btn"
                            onClick={fetchMails}
                            className="p-2 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </header>

                {/* Tab bar */}
                <div className="flex items-center gap-6 px-8 py-3 border-b border-gray-100 shrink-0">
                    <button
                        onClick={() => setActiveTab('scheduled')}
                        className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'scheduled' ? 'text-gray-900 border-[#00A859]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        Scheduled ({scheduledMails.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('sent')}
                        className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'sent' ? 'text-gray-900 border-[#00A859]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        Sent ({sentMails.length})
                    </button>
                </div>

                {/* Email List */}
                <div className="flex-1 overflow-auto">
                    {loading && displayMails.length === 0 && (
                        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                            <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> Loading...
                        </div>
                    )}

                    {!loading && displayMails.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                            {activeTab === 'scheduled' ? (
                                <Clock className="w-10 h-10 mb-3 opacity-30" />
                            ) : (
                                <Send className="w-10 h-10 mb-3 opacity-30" />
                            )}
                            <p className="text-sm font-medium">No {activeTab} emails</p>
                            <p className="text-xs mt-1 text-gray-300">
                                {activeTab === 'scheduled' ? 'Click Compose to schedule one' : 'Sent emails will appear here'}
                            </p>
                        </div>
                    )}

                    {displayMails.map((mail, idx) => (
                        <div
                            key={mail.id || idx}
                            id={`email-row-${idx}`}
                            onClick={() => navigate(`/email/${mail.id}`)}
                            className="flex items-center justify-between border-b border-gray-50 px-8 py-4 hover:bg-gray-50/60 cursor-pointer transition-colors group"
                        >
                            <div className="flex items-center gap-6 flex-1 overflow-hidden min-w-0">
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00A859] to-green-300 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                    {mail.recipient?.[0]?.toUpperCase() || 'E'}
                                </div>

                                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                    {/* Recipient */}
                                    <span className="text-[13px] font-semibold text-gray-800 w-40 truncate shrink-0">
                                        {mail.recipient}
                                    </span>

                                    {/* Time badge */}
                                    <span className="text-[11px] bg-[#FFF3E0] text-[#E65100] px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 border border-[#FFE0B2]">
                                        <Clock className="w-3 h-3" strokeWidth={3} />
                                        {formatDate(activeTab === 'scheduled' ? mail.scheduled_at : mail.sent_at)}
                                    </span>

                                    {/* Subject + body */}
                                    <div className="truncate text-[13px] min-w-0">
                                        <span className="font-semibold text-gray-800">{mail.subject}</span>
                                        <span className="text-gray-300 mx-1">—</span>
                                        <span className="text-gray-400">{mail.body}</span>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className="shrink-0 ml-2">{statusBadge(mail.status)}</div>
                            </div>

                            {/* Star */}
                            <button className="text-gray-200 hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100 ml-4 shrink-0">
                                <Star className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </main>

            {/* Click-outside for user menu */}
            {showUserMenu && (
                <div className="fixed inset-0 z-0" onClick={() => setShowUserMenu(false)} />
            )}
        </div>
    );
};

export default Dashboard;
