import { useState } from 'react';
import { X } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => void;
}

const ApiKeyModal = ({ isOpen, onSave }: ApiKeyModalProps) => {
  const [apiKey, setApiKey] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="glass-panel relative w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">
            Enter Your Google Gemini API Key
          </h2>
          <p className="text-glass-muted text-sm">
            Your API key is stored securely in your browser for this session only
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Enter your Gemini API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="glass-input"
            onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          />
          
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-center text-sm text-glass-muted hover:text-white transition-colors"
          >
            Get your API key →
          </a>
        </div>

        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="w-full glass-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save & Continue
        </button>
      </div>
    </div>
  );
};

export default ApiKeyModal;