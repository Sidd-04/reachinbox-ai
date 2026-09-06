import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Archive, Trash2, ExternalLink, Clock, Send } from 'lucide-react';
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
    provider_id?: string;
    preview_url?: string;
}

const ViewEmail: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [email, setEmail] = useState<Email | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchEmail = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/emails/${id}`);
                setEmail(res.data);
            } catch (err) {
                setError('Email not found');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchEmail();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-gray-400">
                <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-green-500 rounded-full mr-2" />
                Loading...
            </div>
        );
    }

    if (error || !email) {
        return (
            <div className="flex h-screen flex-col items-center justify-center text-gray-400">
                <p className="mb-4 text-lg">{error || 'Email not found'}</p>
                <button onClick={() => navigate('/dashboard')} className="text-sm text-[#00A859] hover:underline">
                    ← Back to Dashboard
                </button>
            </div>
        );
    }

    const dateDisplay = email.sent_at
        ? new Date(email.sent_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : new Date(email.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const senderInitial = email.sender_email?.[0]?.toUpperCase() || 'S';

    return (
        <div className="flex h-screen flex-col bg-white font-sans">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-8 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-[17px] text-gray-800 font-semibold">{email.subject}</h1>
                        <p className="text-xs text-gray-400">ID: {email.id.split('-')[0].toUpperCase()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                    {/* Status badge */}
                    {email.status === 'sent' && (
                        <span className="flex items-center gap-1 text-[11px] bg-[#E5F5EC] text-[#00A859] px-2.5 py-1 rounded-full font-bold">
                            <Send className="w-3 h-3" /> Sent
                        </span>
                    )}
                    {email.status === 'scheduled' && (
                        <span className="flex items-center gap-1 text-[11px] bg-[#FFF3E0] text-[#E65100] px-2.5 py-1 rounded-full font-bold">
                            <Clock className="w-3 h-3" /> Scheduled
                        </span>
                    )}
                    {email.status === 'failed' && (
                        <span className="text-[11px] bg-red-50 text-red-500 px-2.5 py-1 rounded-full font-bold">Failed</span>
                    )}
                    <div className="w-px h-5 bg-gray-200" />
                    <button className="p-1.5 hover:text-gray-600 transition-colors"><Star className="w-4 h-4" /></button>
                    <button className="p-1.5 hover:text-gray-600 transition-colors"><Archive className="w-4 h-4" /></button>
                    <button className="p-1.5 hover:text-gray-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-[#00A859] flex items-center justify-center text-white text-xs font-bold">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-4xl w-full mx-auto px-8 py-8 overflow-auto">
                {/* Email meta */}
                <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00A859] to-green-300 flex items-center justify-center text-white font-bold text-lg">
                            {senderInitial}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[15px] text-gray-900">{email.sender_email.split('@')[0]}</span>
                                <span className="text-[13px] text-gray-400">&lt;{email.sender_email}&gt;</span>
                            </div>
                            <div className="text-[12px] text-gray-400 mt-0.5">
                                To: <span className="text-gray-600">{email.recipient}</span>
                            </div>
                        </div>
                    </div>
                    <span className="text-[13px] text-gray-400 font-medium shrink-0">{dateDisplay}</span>
                </div>

                {/* Subject */}
                <h2 className="text-xl font-bold text-gray-900 mb-6 pl-15">{email.subject}</h2>

                {/* Body */}
                <div className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap pl-15 border-l-2 border-gray-100 ml-2 px-4">
                    {email.body}
                </div>

                {/* Ethereal Preview Link */}
                {email.preview_url && (
                    <div className="mt-8 p-4 bg-[#E5F5EC] rounded-xl border border-green-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-[#00A859]">📬 View in Ethereal Email</p>
                            <p className="text-xs text-gray-500 mt-0.5">Click to see the actual email as it was delivered (fake SMTP preview)</p>
                        </div>
                        <a
                            href={email.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm font-semibold text-[#00A859] hover:text-green-700 bg-white px-4 py-2 rounded-lg border border-green-200 transition-colors ml-4 shrink-0"
                        >
                            Open Preview <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ViewEmail;
