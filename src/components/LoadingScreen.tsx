import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  status: string;
}

const LoadingScreen = ({ status }: LoadingScreenProps) => {
  const [currentStatus, setCurrentStatus] = useState(status);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-panel p-12 text-center space-y-8">
        <div className="loading-orb"></div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            AI is Working Its Magic
          </h2>
          <p className="text-glass-muted text-lg transition-all duration-500">
            {currentStatus}
          </p>
        </div>

        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;