import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { XamanLoginButton } from './components/XamanLoginButton';
import ArtistDashboard from './pages/Artist';
import ListenerDashboard from './pages/Listener';

const App: React.FC = () => {
    const { isAuthenticated, login, account } = useAuth();

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100 p-4">
                <div className="max-w-md mx-auto space-y-8">
                    <h1 className="text-3xl font-bold text-center mb-8">XRPL Music Promotion</h1>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-center mb-4">Connexion</h2>
                        <XamanLoginButton onLogin={login} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/" element={
                <div className="min-h-screen bg-gray-100 p-4">
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="bg-white p-4 rounded-lg shadow-md mb-4">
                            <p className="text-sm text-gray-600">Connecté en tant que :</p>
                            <p className="font-mono text-sm">{account}</p>
                        </div>
                        <h1 className="text-3xl font-bold text-center mb-8">XRPL Music Promotion</h1>
                        <a 
                            href="/artist" 
                            className="block w-full bg-blue-500 text-white p-4 rounded-lg text-center hover:bg-blue-600"
                        >
                            Espace Artiste
                        </a>
                        <a 
                            href="/listener" 
                            className="block w-full bg-green-500 text-white p-4 rounded-lg text-center hover:bg-green-600"
                        >
                            Espace Auditeur
                        </a>
                    </div>
                </div>
            } />
            <Route path="/artist" element={<ArtistDashboard />} />
            <Route path="/listener" element={<ListenerDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App; 