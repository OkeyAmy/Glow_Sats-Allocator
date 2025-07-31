import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import GlassSurface from './GlassSurface';
import ContributorChat from './ContributorChat';
import { NostrNote } from '@/services/nostrService';
import PostDisplay from './PostDisplay';

// Assuming this matches the Contributor type from your service
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
  originalNote: NostrNote;
  replyCount: number;
  onProceed: (allocations: { pubkey: string; sats: number }[]) => void;
}

const RecommendationScreen = ({ 
  contributors, 
  totalBounty, 
  originalNote,
  replyCount,
  onProceed 
}: RecommendationScreenProps) => {
  const [allocations, setAllocations] = useState<{ [pubkey: string]: number }>(
    contributors.reduce((acc, contributor) => {
      acc[contributor.pubkey] = contributor.recommendedSats;
      return acc;
    }, {} as { [pubkey: string]: number })
  );
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);

  const updateAllocation = (pubkey: string, newSats: number) => {
    setAllocations(prev => ({
      ...prev,
      [pubkey]: Math.max(0, newSats)
    }));
  };

  const totalAllocated = Object.values(allocations).reduce((sum, sats) => sum + sats, 0);
  const isOverAllocated = totalAllocated > totalBounty;
  const hasZeroTotal = totalAllocated === 0;

  const handleProceed = () => {
    const finalAllocations = Object.entries(allocations)
      .filter(([, sats]) => sats > 0)
      .map(([pubkey, sats]) => ({ pubkey, sats }));
    
    onProceed(finalAllocations);
  };

  const getNostrLink = (pubkey: string) => {
    return `https://nostr.band/npub${pubkey}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <PostDisplay originalNote={originalNote} replyCount={replyCount} />

      <GlassSurface 
        width="100%" 
        height="auto"
        borderRadius={24}
        brightness={70}
        opacity={0.9}
        className="p-6"
      >
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Distribution Recommendations
          </h2>
          <p className="text-muted-foreground">
            AI found {contributors.length} valuable contributors
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/10 rounded-lg">
          <div className="text-center">
            <span className="text-sm text-muted-foreground block">Total Bounty</span>
            <span className="text-lg font-bold text-foreground">{totalBounty.toLocaleString()}</span>
          </div>
          <div className="text-center">
            <span className="text-sm text-muted-foreground block">Allocated</span>
            <span className={`text-lg font-bold ${isOverAllocated ? 'text-destructive' : 'text-foreground'}`}>
              {totalAllocated.toLocaleString()}
            </span>
          </div>
          <div className="text-center">
            <span className="text-sm text-muted-foreground block">Remaining</span>
            <span className={`text-lg font-bold ${isOverAllocated ? 'text-destructive' : 'text-green-400'}`}>
              {(totalBounty - totalAllocated).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {contributors.map((contributor, index) => (
            <GlassSurface 
              key={contributor.pubkey}
              width="100%" 
              height="auto"
              borderRadius={16}
              brightness={65}
              opacity={0.8}
              className="p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                    <span className="text-white font-bold">
                      {contributor.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{contributor.name}</h3>
                    <a 
                      href={getNostrLink(contributor.pubkey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View Profile →
                    </a>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <Label className="text-xs text-muted-foreground">Reward (sats)</Label>
                    <Input
                      type="number"
                      value={allocations[contributor.pubkey] || 0}
                      onChange={(e) => updateAllocation(contributor.pubkey, Number(e.target.value))}
                      className="w-20 text-center h-8 text-sm"
                      min="0"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-foreground mb-2">Their Reply:</h4>
                <p className="text-sm text-muted-foreground bg-background/30 p-3 rounded-lg leading-relaxed">
                  {contributor.contribution}
                </p>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="flex-1 mr-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">AI Analysis:</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {contributor.aiJustification}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContributor(contributor)}
                  className="px-4 h-8"
                >
                  Chat with AI
                </Button>
              </div>
            </GlassSurface>
          ))}
        </div>

        {isOverAllocated && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm text-center">
              Over-allocated by {(totalAllocated - totalBounty).toLocaleString()} sats. Please adjust.
            </p>
          </div>
        )}

        <Button
          onClick={handleProceed}
          disabled={isOverAllocated || hasZeroTotal}
          className="w-full h-12 text-base bg-gradient-primary hover:opacity-90"
        >
          Send Payments • {totalAllocated.toLocaleString()} sats to {Object.values(allocations).filter(s => s > 0).length} contributors
        </Button>
      </GlassSurface>

      {selectedContributor && (
        <ContributorChat
          contributorName={selectedContributor.name}
          contributorReply={selectedContributor.contribution}
          aiJustification={selectedContributor.aiJustification}
          onClose={() => setSelectedContributor(null)}
        />
      )}
    </div>
  );
};

export default RecommendationScreen;