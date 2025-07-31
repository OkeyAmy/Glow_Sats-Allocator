import { Button } from './ui/button';
import GlassSurface from './GlassSurface';

interface SuccessScreenProps {
  totalSats: number;
  contributorCount: number;
  onShare: () => void;
}

const SuccessScreen = ({ totalSats, contributorCount, onShare }: SuccessScreenProps) => {
  return (
    <div className="w-full max-w-lg mx-auto">
      <GlassSurface 
        width="100%" 
        height="auto"
        borderRadius={24}
        brightness={70}
        opacity={0.9}
        className="p-8 text-center"
      >
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white rounded-full bg-white/20"></div>
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Bounty Distributed!
        </h2>
        
        <div className="space-y-4 mb-8">
          <div className="p-4 bg-muted/10 rounded-lg">
            <p className="text-lg text-muted-foreground">
              Successfully sent
            </p>
            <p className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {totalSats.toLocaleString()} sats
            </p>
          </div>
          
          <div className="p-4 bg-muted/10 rounded-lg">
            <p className="text-lg text-muted-foreground">
              to {contributorCount} valuable contributor{contributorCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <Button
            onClick={onShare}
            className="w-full h-12 text-base bg-gradient-primary hover:opacity-90"
          >
            Share Results on Nostr
          </Button>
          
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full h-12 text-base"
          >
            Analyze Another Thread
          </Button>
        </div>
      </GlassSurface>
    </div>
  );
};

export default SuccessScreen;