import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    account: string | null;
    userToken: string | null;
    login: (account: string, userToken: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth doit être utilisé dans un AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [account, setAccount] = useState<string | null>(null);
    const [userToken, setUserToken] = useState<string | null>(null);

    useEffect(() => {
        const savedAccount = localStorage.getItem('xrpl_account');
        const savedToken = localStorage.getItem('xrpl_token');
        
        if (savedAccount && savedToken) {
            setIsAuthenticated(true);
            setAccount(savedAccount);
            setUserToken(savedToken);
        }
    }, []);

    const login = (newAccount: string, newUserToken: string) => {
        setIsAuthenticated(true);
        setAccount(newAccount);
        setUserToken(newUserToken);
        
        localStorage.setItem('xrpl_account', newAccount);
        localStorage.setItem('xrpl_token', newUserToken);
    };

    const logout = () => {
        setIsAuthenticated(false);
        setAccount(null);
        setUserToken(null);
        
        localStorage.removeItem('xrpl_account');
        localStorage.removeItem('xrpl_token');
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            account,
            userToken,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}; 