import { Button } from './ui/button';
import GlassSurface from './GlassSurface';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SuccessScreenProps {
  totalSats: number;
  contributorCount: number;
  onShare: () => void;
  onReset: () => void;
}

const SuccessScreen = ({ totalSats, contributorCount, onShare, onReset }: SuccessScreenProps) => {
  const { toast } = useToast();

  const handleCopyToClipboard = () => {
    const shareText = `Just distributed a ${totalSats.toLocaleString()} sat bounty to ${contributorCount} amazing contributors! 🚀

Thanks to everyone who added value to the conversation.

Powered by AI Tip & Bounty Allocator ⚡`;
    
    navigator.clipboard.writeText(shareText).then(() => {
      toast({
        title: "Copied to clipboard",
        description: "Share text has been copied to your clipboard",
      });
    });
  };

  return (
    <div className="w-full h-full max-w-lg mx-auto flex items-center justify-center">
      <GlassSurface 
        width="100%" 
        height="auto"
        borderRadius={24}
        brightness={70}
        opacity={0.9}
        className="p-8 text-center"
      >
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center border-4 border-green-500/30">
            <Check className="w-8 h-8 text-green-300" strokeWidth={3} />
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
        
        <div className="space-y-3">
          <Button
            onClick={onShare}
            className="w-full h-11 text-sm bg-gradient-primary hover:opacity-90"
          >
            Share Results on Nostr
          </Button>
          
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            className="w-full h-11 text-sm"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy to Clipboard
          </Button>
          
          <Button
            variant="outline"
            onClick={onReset}
            className="w-full h-11 text-sm"
          >
            Analyze Another Thread
          </Button>
        </div>
      </GlassSurface>
    </div>
  );
};

export default SuccessScreen;