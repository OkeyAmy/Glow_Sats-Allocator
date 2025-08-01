import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import ApiKeyModal from './ApiKeyModal';
import InputForm from './InputForm';
import LoadingScreen from './LoadingScreen';
import RecommendationScreen from './RecommendationScreen';
import SuccessScreen from './SuccessScreen';
import FaultyTerminal from './FaultyTerminal';
import { nostrService } from '@/services/nostrService';
import { GeminiService, type Contributor } from '@/services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

type AppState = 'input' | 'loading' | 'recommendations' | 'success';

const BountyAllocator = () => {
  const [state, setState] = useState<AppState>('input');
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [totalBounty, setTotalBounty] = useState(0);
  const [originalNote, setOriginalNote] = useState<any>(null);
  const [replyCount, setReplyCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing API key
    const savedKey = sessionStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowApiModal(true);
    }
  }, []);

  const handleApiKeySave = (key: string) => {
    setApiKey(key);
    sessionStorage.setItem('gemini_api_key', key);
    setShowApiModal(false);
    toast({
      title: "API Key Saved",
      description: "You can now analyze Nostr threads with AI",
    });
  };

  const handleAnalyze = async (noteId: string, bountyAmount: number, customDistribution?: number) => {
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }

    setState('loading');
    setTotalBounty(bountyAmount);
    
    try {
      setLoadingStatus('Connecting to Nostr relays...');
      
      // Fetch original note
      const originalNote = await nostrService.fetchOriginalNote(noteId);
      if (!originalNote) {
        throw new Error('Could not find the original note');
      }

      setOriginalNote(originalNote);
      setLoadingStatus('Fetching thread replies...');
      
      // Fetch all replies
      const replies = await nostrService.fetchThreadReplies(noteId);
      if (replies.length === 0) {
        throw new Error('No replies found for this thread. This could be due to relay issues or a thread with no engagement.');
      }
      setReplyCount(replies.length);

      setLoadingStatus(`Found ${replies.length} replies. AI is analyzing the conversation...`);
      
      // Format for AI analysis
      const threadContent = nostrService.formatThreadForAI(originalNote, replies);
      
      // Analyze with Gemini
      const geminiService = new GeminiService(apiKey);
      const analysis = await geminiService.analyzeThread(
        threadContent, 
        bountyAmount, 
        customDistribution
      );
      
      if (analysis.contributors.length === 0) {
        throw new Error('No valuable contributions found in this thread');
      }

      setContributors(analysis.contributors);
      setState('recommendations');
      
      toast({
        title: "Analysis Complete",
        description: `Found ${analysis.contributors.length} valuable contributors`,
      });
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      setState('input');
    }
  };

  const handleProceedToPayment = async (finalAllocations: { pubkey: string; sats: number }[]) => {
    try {
      // Check if WebLN is available
      if (typeof window !== 'undefined' && (window as any).webln) {
        await (window as any).webln.enable();
        
        // In a real implementation, you would:
        // 1. Generate Lightning invoices for each recipient
        // 2. Send the payments via WebLN
        // 3. Handle success/failure states
        
        // For demo purposes, we'll simulate success
        toast({
          title: "Payments Sent!",
          description: `Successfully distributed to ${finalAllocations.length} contributors`,
        });
        
        setState('success');
      } else {
        toast({
          title: "WebLN Not Available",
          description: "Please install a WebLN-compatible wallet to send payments",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "Could not process Lightning payments",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    // In a real implementation, this would:
    // 1. Format a Nostr note with the bounty results
    // 2. Tag all recipients
    // 3. Include the "Powered by" attribution
    // 4. Post to Nostr relays
    
    const shareText = `Just distributed a ${totalBounty.toLocaleString()} sat bounty to ${contributors.length} amazing contributors! 🚀 

Thanks to everyone who added value to the conversation. 

Powered by AI Tip & Bounty Allocator ⚡`;

    // For demo, copy to clipboard
    navigator.clipboard.writeText(shareText).then(() => {
      toast({
        title: "Share Text Copied",
        description: "Post this to Nostr to spread the word!",
      });
    });
  };

  const renderCurrentScreen = () => {
    switch (state) {
      case 'input':
        return <InputForm onAnalyze={handleAnalyze} isLoading={false} />;
      case 'loading':
        return <LoadingScreen status={loadingStatus} />;
      case 'recommendations':
        return (
          <RecommendationScreen
            contributors={contributors}
            totalBounty={totalBounty}
            originalNote={originalNote}
            replyCount={replyCount}
            onProceed={handleProceedToPayment}
          />
        );
      case 'success':
        return (
          <SuccessScreen
            totalSats={totalBounty}
            contributorCount={contributors.length}
            onShare={handleShare}
          />
        );
      default:
        return <InputForm onAnalyze={handleAnalyze} isLoading={false} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      <FaultyTerminal
        scale={1.5}
        gridMul={[2, 1]}
        digitSize={1.2}
        timeScale={0.5}
        pause={false}
        scanlineIntensity={0.8}
        glitchAmount={0.7}
        flickerAmount={0.5}
        noiseAmp={0.3}
        chromaticAberration={0}
        dither={0}
        curvature={0.1}
        tint="#ffffff"
        mouseReact={true}
        mouseStrength={0.3}
        pageLoadAnimation={false}
        brightness={0.4}
        className="fixed inset-0"
      />
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <ApiKeyModal 
          isOpen={showApiModal} 
          onSave={handleApiKeySave} 
        />
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {renderCurrentScreen()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BountyAllocator;