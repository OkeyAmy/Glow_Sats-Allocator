import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import GlassSurface from './GlassSurface';
import './ContributorChat.css';
import { GeminiService, type ChatMessage } from '@/services/geminiService';

interface ContributorChatProps {
  contributorName: string;
  contributorReply: string;
  aiJustification: string;
  onClose: () => void;
  userBalance?: number;
}

const ContributorChat: React.FC<ContributorChatProps> = ({
  contributorName,
  contributorReply,
  aiJustification,
  onClose,
  userBalance = 0
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [geminiService, setGeminiService] = useState<GeminiService | null>(null);

  useEffect(() => {
    const savedKey = sessionStorage.getItem('gemini_api_key');
    if (savedKey) {
      setGeminiService(new GeminiService(savedKey));
    }
    
    // Set initial context for the AI
    const initialContext: ChatMessage = {
      role: 'user',
      parts: [{
        text: `You are an AI assistant analyzing a contribution in a Nostr thread. 
        The contributor is ${contributorName}.
        Their reply was: "${contributorReply}"
        Your initial analysis was: "${aiJustification}"
        
        Now, answer my questions based on this context.`
      }]
    };
    setMessages([initialContext]);

  }, [contributorName, contributorReply, aiJustification]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !geminiService) return;

    const userMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: inputValue.trim() }]
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const aiResponse = await geminiService.chatWithAI(newMessages);
      const aiMessage: ChatMessage = {
        role: 'model',
        parts: [{ text: aiResponse }]
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        role: 'model',
        parts: [{ text: "Sorry, I encountered an error. Please try again." }]
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const displayedMessages = messages.slice(1); // Don't display the initial context message

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header with Back button and Balance */}
      <div className="flex items-center justify-between p-3 border-b border-border/20">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="flex items-center gap-2"
        >
          ← Back
        </Button>
        
        <div className="text-sm">
          <span className="text-muted-foreground">Balance:</span>
          <span className="ml-1 font-medium text-primary">{userBalance.toLocaleString()} sats</span>
        </div>
      </div>

      {/* Content Area - Single Column Layout */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Original Contribution Section */}
        <div className="border-b border-border/10 p-4 bg-muted/5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Original Contribution
          </h3>
          <div className="space-y-3">
            <div className="bg-background/50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-foreground mb-1">Reply from {contributorName}:</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {contributorReply}
              </p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3">
              <h4 className="text-xs font-medium text-foreground mb-1">AI Analysis:</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {aiJustification}
              </p>
            </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="flex-1 flex flex-col p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Chat with AI Assistant
            </h3>
            <p className="text-xs text-muted-foreground">
              Ask follow-up questions
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {displayedMessages.map((message, index) => (
              <div key={index} className="animate-fade-in transition-all duration-300">
                <div className={`p-3 rounded-lg text-xs ${message.role === 'user' ? 'bg-muted/20 ml-6' : 'bg-primary/10 mr-6'}`}>
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <p className="font-medium text-foreground mb-1">
                        {message.role === 'user' ? 'You' : 'AI Assistant'}
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        {message.parts[0].text}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="mr-6">
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse pulse-delay-1"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse pulse-delay-2"></div>
                    <span className="text-xs text-muted-foreground ml-2">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-3 border-t border-border/10 mt-3">
            <div className="flex space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about this contribution..."
                className="flex-1 text-sm"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="sm"
                className="px-4"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContributorChat;