import { useState } from 'react';
import { Zap } from 'lucide-react';

interface InputFormProps {
  onAnalyze: (noteId: string, bountyAmount: number) => void;
  isLoading: boolean;
}

const InputForm = ({ onAnalyze, isLoading }: InputFormProps) => {
  const [noteId, setNoteId] = useState('');
  const [bountyAmount, setBountyAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noteId.trim() && bountyAmount.trim()) {
      onAnalyze(noteId.trim(), parseInt(bountyAmount));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-panel p-8 space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">
            AI Tip & Bounty Allocator
          </h1>
          <p className="text-glass-muted text-lg">
            Let AI analyze your Nostr thread and suggest fair tip distributions
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-white font-medium">
              Nostr Note ID
            </label>
            <input
              type="text"
              placeholder="Enter the note ID of the thread..."
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              className="glass-input"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-white font-medium">
              Bounty Amount (sats)
            </label>
            <input
              type="number"
              placeholder="5000"
              value={bountyAmount}
              onChange={(e) => setBountyAmount(e.target.value)}
              className="glass-input"
              min="1"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={!noteId.trim() || !bountyAmount.trim() || isLoading}
            className="w-full glass-button-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Analyze & Suggest Allocation'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InputForm;