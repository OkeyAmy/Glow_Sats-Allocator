import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import GlassSurface from './GlassSurface';

interface InputFormProps {
  onAnalyze: (noteId: string, bountyAmount: number, customDistribution?: number) => void;
  isLoading: boolean;
}

const InputForm = ({ onAnalyze, isLoading }: InputFormProps) => {
  const [noteId, setNoteId] = useState('');
  const [bountyAmount, setBountyAmount] = useState(1000);
  const [useCustomDistribution, setUseCustomDistribution] = useState(false);
  const [customDistribution, setCustomDistribution] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!noteId.trim()) {
      return;
    }
    
    if (bountyAmount <= 0) {
      return;
    }
    
    onAnalyze(
      noteId.trim(), 
      bountyAmount, 
      useCustomDistribution ? customDistribution : undefined
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-3">
          AI Bounty Allocator
        </h1>
        <p className="text-muted-foreground text-lg">
          Analyze threads and reward valuable contributions
        </p>
      </div>
      
      <GlassSurface 
        width="100%" 
        height="auto"
        borderRadius={24}
        brightness={70}
        opacity={0.9}
        className="p-8"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="noteId" className="text-foreground text-base font-medium">
              Thread to Analyze
            </Label>
            <Input
              id="noteId"
              type="text"
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              placeholder="note1... or nevent1... or hex ID"
              className="w-full h-12 text-base"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Supports both bech32 identifiers (note1..., nevent1...) and hex event IDs
            </p>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="bountyAmount" className="text-foreground text-base font-medium">
              Total Bounty Amount
            </Label>
            <div className="relative">
              <Input
                id="bountyAmount"
                type="number"
                value={bountyAmount}
                onChange={(e) => setBountyAmount(Number(e.target.value))}
                placeholder="1000"
                min="1"
                className="w-full h-12 text-base pr-12"
                disabled={isLoading}
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                sats
              </span>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-foreground text-base font-medium">
                  Distribution Control
                </Label>
                <p className="text-sm text-muted-foreground">
                  {useCustomDistribution ? `Reward top ${customDistribution} contributors` : 'Let AI decide best allocation'}
                </p>
              </div>
              <Switch
                checked={useCustomDistribution}
                onCheckedChange={setUseCustomDistribution}
                disabled={isLoading}
              />
            </div>

            {useCustomDistribution && (
              <div className="space-y-3 animate-fade-in">
                <Label htmlFor="customDistribution" className="text-foreground text-sm font-medium">
                  Number of Contributors
                </Label>
                <Input
                  id="customDistribution"
                  type="number"
                  value={customDistribution}
                  onChange={(e) => setCustomDistribution(Number(e.target.value))}
                  min="1"
                  max="20"
                  className="w-full h-10"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>
          
          <Button
            type="submit"
            className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 transition-all duration-200"
            disabled={isLoading || !noteId.trim() || bountyAmount <= 0}
          >
            {isLoading ? "Analyzing Thread..." : "Analyze & Distribute"}
          </Button>
        </form>
      </GlassSurface>
    </div>
  );
};

export default InputForm;