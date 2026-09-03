import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        isOnline
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      }`}
      title={isOnline ? 'Connecté (données conservées 100% en local)' : 'Mode hors ligne actif — fonctionnement local complet'}
    >
      {isOnline ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Wifi className="w-3 h-3" />
          <span className="hidden sm:inline">Local / En ligne</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <WifiOff className="w-3 h-3" />
          <span>Hors ligne (100% autonome)</span>
        </>
      )}
    </div>
  );
};
