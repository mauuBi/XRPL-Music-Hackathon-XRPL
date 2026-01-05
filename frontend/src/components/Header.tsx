import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
    userType: 'artist' | 'listener';
    account: string;
}

const Header: React.FC<HeaderProps> = ({ userType, account }) => {
    return (
        <header className="bg-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Link to="/" className="block">
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                                XRPL Music
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {userType === 'artist' ? 'Espace Artiste' : 'Écoutez de la musique, gagnez des XRP'}
                            </p>
                        </Link>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Compte {userType === 'artist' ? 'artiste' : 'auditeur'}</p>
                        <p className="font-mono text-sm truncate max-w-[200px]">{account}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header; 