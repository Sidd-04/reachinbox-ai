import React, { createContext, useContext, useState, useCallback } from 'react';

export interface User {
    google_id: string;
    name: string;
    email: string;
    avatar: string;
    slack_connected: boolean;
    slack_channel?: string;
}

interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    updateSlackStatus: (connected: boolean, channel?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: () => {},
    logout: () => {},
    updateSlackStatus: () => {},
});

const STORAGE_KEY = 'reachinbox_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const login = useCallback((u: User) => {
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const updateSlackStatus = useCallback((connected: boolean, channel?: string) => {
        setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, slack_connected: connected, slack_channel: channel };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, updateSlackStatus }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
