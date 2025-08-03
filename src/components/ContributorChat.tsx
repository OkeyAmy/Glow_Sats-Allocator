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
}

const ContributorChat: React.FC<ContributorChatProps> = ({
  contributorName,
  contributorReply,
  aiJustification,
  onClose
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="relative w-full max-w-4xl h-[80vh] flex space-x-4">
        {/* Left Panel */}
        <div className="relative w-1/2 h-full">
          <GlassSurface
            width="100%"
            height="100%"
            borderRadius={24}
            brightness={80}
            opacity={1}
            className="absolute inset-0"
          />
          <div className="relative z-10 p-6 flex flex-col h-full">
            <div className="border-b border-border/20 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Original Contribution
              </h3>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div className="bg-muted/20 rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Original Reply from {contributorName}:</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {contributorReply}
                </p>
              </div>
              <div className="bg-primary/10 rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">AI Analysis:</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {aiJustification}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="relative w-1/2 h-full">
          <GlassSurface
            width="100%"
            height="100%"
            borderRadius={24}
            brightness={80}
            opacity={1}
            className="absolute inset-0"
          />
          <div className="relative z-10 p-6 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-border/20 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Chat with AI Assistant
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask follow-up questions
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="px-4"
              >
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {displayedMessages.map((message, index) => (
                <div key={index} className={`animate-fade-in transition-all duration-300`}>
                  <div className={`p-4 rounded-lg ${message.role === 'user' ? 'bg-muted/20 ml-8' : 'bg-primary/10 mr-8'}`}>
                    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <p className="text-sm font-medium text-foreground mb-1">
                          {message.role === 'user' ? 'You' : 'AI Assistant'}
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {message.parts[0].text}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
               {isLoading && (
                <div className="mr-8">
                  <div className="p-4 rounded-lg bg-primary/10">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse pulse-delay-1"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse pulse-delay-2"></div>
                      <span className="text-sm text-muted-foreground ml-2">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-4">
              <div className="flex space-x-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about this contribution..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="px-6"
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContributorChat;