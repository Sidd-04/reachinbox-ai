import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, Clock, Upload, Calendar, CheckCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const ComposeEmail: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [showSendLater, setShowSendLater] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(new Date());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendError, setSendError] = useState('');

    const [form, setForm] = useState({
        to: '',
        subject: '',
        body: '',
        delaySeconds: '',
        hourlyLimit: ''
    });
    
    const [uploadList, setUploadList] = useState<string[]>([]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            // Simple split by newline, comma, etc for emails
            const emails = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];
            if (emails.length > 0) {
                setUploadList([...new Set(emails)]);
                alert(`Found ${[...new Set(emails)].length} unique email(s).`);
            } else {
                alert('No valid emails found in file.');
            }
        };
        reader.readAsText(file);
    };

    const handleSend = async () => {
        if (!form.to && uploadList.length === 0) { setSendError('Please enter a recipient or upload a list'); return; }
        if (!form.subject) { setSendError('Subject is required'); return; }
        setSendError('');
        setSending(true);
        try {
            const payload = {
                from: user?.email || 'user@reachinbox.ai',
                to: form.to,
                list: uploadList.length > 0 ? uploadList : undefined,
                subject: form.subject,
                body: form.body,
                delaySeconds: form.delaySeconds ? parseInt(form.delaySeconds) : undefined,
                hourlyLimit: form.hourlyLimit ? parseInt(form.hourlyLimit) : undefined,
                sendAt: showSendLater && startDate ? startDate.toISOString() : undefined
            };
            await api.post('/emails/schedule', payload);
            setSent(true);
            setTimeout(() => navigate('/dashboard'), 1500);
        } catch (error) {
            console.error('Failed to schedule email', error);
            setSendError('Failed to schedule email. Is the backend running?');
        } finally {
            setSending(false);
        }
    };

    const setQuickTime = (hoursFromNow: number) => {
        const d = new Date();
        d.setHours(d.getHours() + hoursFromNow);
        d.setMinutes(0);
        setStartDate(d);
    };

    return (
        <div className="min-h-screen bg-white text-gray-800 font-sans flex flex-col relative">
            {/* Header */}
            <header className="h-[72px] flex items-center justify-between px-8 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/dashboard')} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <ArrowLeft className="w-[22px] h-[22px]" />
                    </button>
                    <h1 className="text-[20px] text-gray-800 font-medium tracking-tight">Compose New Email</h1>
                </div>
                <div className="flex items-center gap-5">
                    <button className="text-gray-400 hover:text-gray-600">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                        className={`${showSendLater ? 'text-[#00A859]' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                        onClick={() => setShowSendLater(!showSendLater)}
                    >
                        <Clock className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleSend}
                        disabled={sending || sent}
                        className="bg-white border border-[#00A859] text-[#00A859] px-7 py-1.5 rounded-full text-[14px] font-semibold hover:bg-[#E5F5EC] transition-colors disabled:opacity-60 flex items-center gap-2"
                    >
                        {sent ? <><CheckCircle className="w-4 h-4" /> Scheduled!</> : sending ? 'Sending...' : showSendLater ? 'Send Later' : 'Send'}
                    </button>
                </div>
            </header>

            {/* Error banner */}
            {sendError && (
                <div className="mx-auto w-full max-w-[1000px] px-10 pt-4">
                    <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-2.5 text-sm">
                        {sendError}
                    </div>
                </div>
            )}

            <div className="flex-1 max-w-[1000px] w-full mx-auto p-10 relative">
                <div className="space-y-0">

                    <div className="flex items-center border-b border-gray-100 py-4">
                        <span className="text-[14px] font-semibold text-gray-800 w-[120px]">From</span>
                        <select className="bg-[#F6F7F9] border-none text-[14px] font-medium text-gray-700 rounded-lg py-1.5 px-3 outline-none min-w-[220px]">
                            <option>{user?.email || 'user@reachinbox.ai'}</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between border-b border-gray-100 py-4">
                        <div className="flex items-center flex-1">
                            <span className="text-[14px] font-semibold text-gray-800 w-[120px]">To</span>
                            <input
                                type="text"
                                value={form.to}
                                onChange={e => setForm({...form, to: e.target.value})}
                                placeholder="recipient@example.com"
                                className="flex-1 text-[14px] border-none bg-transparent outline-none placeholder-gray-400"
                            />
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt" onChange={handleFileUpload} />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 text-[14px] text-[#00A859] font-semibold hover:text-green-700 transition-colors"
                        >
                            <Upload className="w-4 h-4" /> Upload List
                        </button>
                        {uploadList.length > 0 && <span className="ml-3 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">{uploadList.length} leads</span>}
                    </div>

                    <div className="flex items-center border-b border-gray-100 py-4">
                        <span className="text-[14px] font-semibold text-gray-800 w-[120px]">Subject</span>
                        <input
                            type="text"
                            value={form.subject}
                            onChange={e => setForm({...form, subject: e.target.value})}
                            placeholder="Subject"
                            className="flex-1 text-[14px] border-none bg-transparent outline-none placeholder-gray-300"
                        />
                    </div>

                    <div className="flex items-center gap-8 py-5">
                        <div className="flex items-center gap-4">
                            <span className="text-[13px] font-semibold text-gray-800">Delay between 2 emails</span>
                            <input 
                                type="text" 
                                value={form.delaySeconds}
                                onChange={e => setForm({...form, delaySeconds: e.target.value})}
                                placeholder="00" 
                                className="w-16 border border-gray-200 rounded-lg text-center py-1.5 text-[13px] outline-none focus:border-[#00A859] transition-colors" 
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[13px] font-semibold text-gray-800">Hourly Limit</span>
                            <input 
                                type="text" 
                                value={form.hourlyLimit}
                                onChange={e => setForm({...form, hourlyLimit: e.target.value})}
                                placeholder="00" 
                                className="w-16 border border-gray-200 rounded-lg text-center py-1.5 text-[13px] outline-none focus:border-[#00A859] transition-colors" 
                            />
                        </div>
                    </div>

                    {/* Editor Container */}
                    <div className="bg-[#F9FAFB] rounded-xl p-5 min-h-[400px] flex flex-col relative mt-2">
                        <textarea
                            value={form.body}
                            onChange={e => setForm({...form, body: e.target.value})}
                            className="flex-1 bg-transparent border-none outline-none text-[15px] text-gray-700 resize-none pt-14"
                            placeholder="Type Your Reply..."
                        ></textarea>

                        {/* Toolbar purely visual as per Figma component */}
                        <div className="absolute top-4 left-4 right-4 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-xl py-2.5 px-6 flex items-center justify-between border border-gray-50">
                            <div className="flex items-center gap-5 text-gray-400">
                                <button className="hover:text-gray-600 transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
                                <button className="hover:text-gray-600 transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg></button>
                                <div className="w-[1px] h-5 bg-gray-200 mx-1"></div>
                                <button className="hover:text-gray-600 font-serif font-bold italic text-lg leading-none transition-colors">T<span className="text-xs pr-1 relative top-[-4px]">T</span></button>
                                <div className="w-[1px] h-5 bg-gray-200 mx-1"></div>
                                <button className="hover:text-gray-600 font-bold text-[17px] transition-colors">B</button>
                                <button className="hover:text-gray-600 font-serif italic text-[17px] transition-colors">I</button>
                                <button className="hover:text-gray-600 underline text-[17px] transition-colors">U</button>
                                <div className="w-[1px] h-5 bg-gray-200 mx-1 hidden sm:block"></div>
                                <button className="hover:text-gray-600 hidden sm:block transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg></button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Send Later Dialog overlay */}
                {showSendLater && (
                    <div className="absolute top-0 right-[-340px] w-[340px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl border border-gray-100 p-7 z-10 transition-all">
                        <h3 className="text-[15px] font-bold text-gray-800 mb-5">Send Later</h3>

                        <div className="relative mb-6">
                            <DatePicker 
                                selected={startDate} 
                                onChange={(date: Date | null) => setStartDate(date)} 
                                showTimeSelect
                                dateFormat="MMMM d, yyyy h:mm aa"
                                className="w-full text-[14px] font-medium text-gray-600 border-b border-gray-200 pb-2.5 bg-transparent outline-none cursor-pointer"
                            />
                            <Calendar className="w-[18px] h-[18px] text-gray-400 absolute right-0 top-0.5 pointer-events-none" />
                        </div>

                        <ul className="space-y-4 mb-10">
                            <li onClick={() => setQuickTime(24)} className="text-[14px] text-gray-500 font-medium hover:text-gray-900 cursor-pointer transition-colors">Tomorrow</li>
                            <li onClick={() => {const d = new Date(); d.setDate(d.getDate()+1); d.setHours(10,0,0,0); setStartDate(d);}} className="text-[14px] text-gray-500 font-medium hover:text-gray-900 cursor-pointer transition-colors">Tomorrow, 10:00 AM</li>
                            <li onClick={() => {const d = new Date(); d.setDate(d.getDate()+1); d.setHours(11,0,0,0); setStartDate(d);}} className="text-[14px] text-gray-500 font-medium hover:text-gray-900 cursor-pointer transition-colors">Tomorrow, 11:00 AM</li>
                            <li onClick={() => {const d = new Date(); d.setDate(d.getDate()+1); d.setHours(15,0,0,0); setStartDate(d);}} className="text-[14px] text-gray-500 font-medium hover:text-gray-900 cursor-pointer transition-colors">Tomorrow, 3:00 PM</li>
                        </ul>

                        <div className="flex items-center justify-between mt-2">
                            <button
                                onClick={() => setShowSendLater(false)}
                                className="text-[14px] font-bold text-gray-800 hover:text-gray-600 transition-colors px-2"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSend}
                                className="text-[14px] font-bold text-[#00A859] border border-[#00A859] px-7 py-2 rounded-full hover:bg-[#E5F5EC] transition-colors shadow-sm"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComposeEmail;
