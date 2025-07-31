import { Check, Share2, Sparkles } from 'lucide-react';

interface SuccessScreenProps {
  totalSats: number;
  contributorCount: number;
  onShare: () => void;
}

const SuccessScreen = ({ totalSats, contributorCount, onShare }: SuccessScreenProps) => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-panel p-12 text-center space-y-8">
        <div className="success-icon">
          <Check className="w-12 h-12 text-white" />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-4xl font-bold text-white">
            Bounty Distributed!
          </h2>
          <p className="text-glass-muted text-lg">
            Successfully sent {totalSats.toLocaleString()} sats to {contributorCount} contributors
          </p>
        </div>

        <div className="flex items-center justify-center space-x-2 text-glass-muted">
          <Sparkles className="w-5 h-5" />
          <span>Powered by AI-driven fair allocation</span>
          <Sparkles className="w-5 h-5" />
        </div>

        <button
          onClick={onShare}
          className="w-full glass-button-primary py-4 text-lg animate-glow flex items-center justify-center space-x-3"
        >
          <Share2 className="w-5 h-5" />
          <span>Share Results on Nostr</span>
        </button>

        <p className="text-glass-muted text-sm">
          Let everyone know who added value and show the power of community rewards
        </p>
      </div>
    </div>
  );
};

export default SuccessScreen;