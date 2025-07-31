import { useState } from 'react';
import { User, Edit3, ArrowRight } from 'lucide-react';

interface Contributor {
  name: string;
  pubkey: string;
  contribution: string;
  recommendedSats: number;
  aiJustification: string;
}

interface RecommendationScreenProps {
  contributors: Contributor[];
  totalBounty: number;
  onProceed: (finalAllocations: { pubkey: string; sats: number }[]) => void;
}

const RecommendationScreen = ({ contributors, totalBounty, onProceed }: RecommendationScreenProps) => {
  const [allocations, setAllocations] = useState(
    contributors.map(c => ({ pubkey: c.pubkey, sats: c.recommendedSats }))
  );

  const currentTotal = allocations.reduce((sum, a) => sum + a.sats, 0);
  const isOverAllocated = currentTotal > totalBounty;

  const updateAllocation = (pubkey: string, newSats: number) => {
    setAllocations(prev => 
      prev.map(a => a.pubkey === pubkey ? { ...a, sats: Math.max(0, newSats) } : a)
    );
  };

  const handleProceed = () => {
    if (!isOverAllocated && currentTotal > 0) {
      onProceed(allocations);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">
            AI Recommendations
          </h2>
          <div className="text-right">
            <div className="text-lg font-medium text-white">
              {currentTotal.toLocaleString()} / {totalBounty.toLocaleString()} sats
            </div>
            {isOverAllocated && (
              <div className="text-red-300 text-sm">Over allocated!</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {contributors.map((contributor, index) => {
          const allocation = allocations.find(a => a.pubkey === contributor.pubkey);
          return (
            <div key={contributor.pubkey} className="contributor-card">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">
                      {contributor.name || `Contributor ${index + 1}`}
                    </h3>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={allocation?.sats || 0}
                          onChange={(e) => updateAllocation(contributor.pubkey, parseInt(e.target.value) || 0)}
                          className="glass-input w-24 py-1 px-2 text-sm text-center"
                          min="0"
                        />
                        <span className="text-glass-muted text-sm">sats</span>
                      </div>
                      <Edit3 className="w-4 h-4 text-glass-muted" />
                    </div>
                  </div>
                  
                  <p className="text-glass-muted text-sm">
                    {contributor.contribution}
                  </p>
                  
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-glass-muted uppercase tracking-wide mb-1">
                      AI Justification
                    </div>
                    <p className="text-sm text-glass">
                      {contributor.aiJustification}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel p-6">
        <button
          onClick={handleProceed}
          disabled={isOverAllocated || currentTotal === 0}
          className="w-full glass-button-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <span>Proceed to Payment</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default RecommendationScreen;