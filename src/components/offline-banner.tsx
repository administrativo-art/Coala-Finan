'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className={cn(
      'fixed bottom-4 left-1/2 z-50 -translate-x-1/2',
      'flex items-center gap-2 rounded-full border border-amber-500/50',
      'bg-background/80 px-4 py-2 text-sm backdrop-blur-md shadow-lg'
    )}>
      <WifiOff className="h-4 w-4 text-amber-500" />
      <span className="text-muted-foreground font-medium">
        Modo offline — exibindo dados em cache
      </span>
    </div>
  );
}
