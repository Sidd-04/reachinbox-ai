import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const hasGoogleClientId = () => {
        const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        return id && id !== 'YOUR_GOOGLE_CLIENT_ID' && id.length > 10;
    };

    // Real Google OAuth handler
    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (codeResponse) => {
            setLoading(true);
            setError('');
            try {
                // Send access_token to backend to verify + upsert user
                const res = await api.post('/auth/google', { token: codeResponse.access_token });
                login(res.data.user);
                navigate('/dashboard');
            } catch (err: any) {
                console.error('Backend auth failed:', err);
                setError('Authentication failed. Please try again.');
                setLoading(false);
            }
        },
        onError: (error) => {
            console.error('Google OAuth popup error:', error);
            setError('Google sign-in was cancelled or failed.');
            setLoading(false);
        },
    });

    const handleGoogleClick = () => {
        if (!hasGoogleClientId()) {
            // Dev fallback: log in with a mock user
            const mockUser = {
                google_id: 'dev-mock-user',
                name: 'Oliver Brown',
                email: 'oliver.brown@domain.io',
                avatar: 'https://i.pravatar.cc/150?img=11',
                slack_connected: false,
            };
            login(mockUser);
            navigate('/dashboard');
            return;
        }
        setLoading(true);
        loginWithGoogle();
    };

    const handleEmailLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const mockUser = {
            google_id: 'email-user',
            name: 'Oliver Brown',
            email: 'oliver.brown@domain.io',
            avatar: 'https://i.pravatar.cc/150?img=11',
            slack_connected: false,
        };
        login(mockUser);
        navigate('/dashboard');
    };

    return (
        <div className="flex h-screen items-center justify-center bg-[#F6F7F9]">
            <div className="w-full max-w-[400px] rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
                {/* Logo */}
                <div className="mb-6 text-center">
                    <span className="text-3xl font-black tracking-tighter text-black">ONG</span>
                </div>

                <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">Welcome back</h2>
                <p className="mb-8 text-center text-sm text-gray-400">Sign in to your account</p>

                {/* Google Sign In */}
                <button
                    id="google-login-btn"
                    onClick={handleGoogleClick}
                    disabled={loading}
                    className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {loading ? 'Signing in...' : 'Continue with Google'}
                </button>

                {/* Error message */}
                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-xs text-red-600 text-center">
                        {error}
                    </div>
                )}

                {!hasGoogleClientId() && (
                    <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-700 text-center">

                    </div>
                )}

                <div className="relative mb-4 flex items-center">
                    <div className="flex-grow border-t border-gray-100"></div>
                    <span className="shrink-0 px-4 text-xs font-medium text-gray-400">or sign in with email</span>
                    <div className="flex-grow border-t border-gray-100"></div>
                </div>

                <form onSubmit={handleEmailLogin}>
                    <div className="mb-3">
                        <input
                            type="email"
                            placeholder="Email ID"
                            className="w-full rounded-xl border border-gray-200 bg-[#F6F7F9] px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200 placeholder-gray-400"
                        />
                    </div>
                    <div className="mb-6">
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full rounded-xl border border-gray-200 bg-[#F6F7F9] px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200 placeholder-gray-400"
                        />
                    </div>
                    <button
                        id="email-login-btn"
                        type="submit"
                        className="w-full rounded-xl bg-[#00A859] py-3 text-sm font-semibold text-white hover:bg-green-600 transition-colors shadow-sm"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
