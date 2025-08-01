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
import { SWhandler } from 'smart-widget-handler';
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
  const [initialNoteId, setInitialNoteId] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing API key
    const savedKey = sessionStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowApiModal(true);
    }

    // Check for initial note ID from widget context
        try {
      SWhandler.client.listen((e) => {
        if (e.data?.noteId) {
          setInitialNoteId(e.data.noteId);
          toast({
            title: "Note ID Received",
            description: "Pre-filled from Nostr client",
          });
        }
      });
    } catch (error) {
      // Not in iframe or cross-origin issues, continue normally
    }
  }, [toast]);

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
      // Simulate payment success (keep existing logic)
      toast({
        title: "Payments Sent!",
        description: `Successfully distributed to ${finalAllocations.length} contributors`,
      });
      
            // Send results back to parent Nostr client
      SWhandler.client.sendContext({
        action: 'bounty_distributed',
        results: {
          totalSats: totalBounty,
          contributors: finalAllocations,
          originalNoteId: originalNote?.id,
          distributionComplete: true
        }
      });
      
      setState('success');
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "Could not process Lightning payments",
        variant: "destructive",
      });
    }
  };

    const handleShare = async () => {
    try {
      const recipientTags = contributors.map(c => ['p', c.pubkey]);
      const shareText = `Just distributed a ${totalBounty.toLocaleString()} sat bounty to ${contributors.length} amazing contributors! 🚀

Thanks to everyone who added value to the conversation.

Original post: nostr:${originalNote?.id}

Powered by AI Tip & Bounty Allocator ⚡`;

      const noteTemplate = {
        kind: 1,
        content: shareText,
        tags: [
          ...recipientTags,
          ...(originalNote ? [['e', originalNote.id, '', 'root']] : []),
          ['t', 'bounty'],
          ['t', 'tips'],
        ],
      };

      const publishedEvent = await SWhandler.client.requestEventPublish(noteTemplate);

      if (publishedEvent) {
        toast({
          title: "Shared to Nostr!",
          description: "Your bounty distribution has been posted to Nostr",
        });
      } else {
        throw new Error("Publishing was not confirmed by the client.");
      }
    } catch (error) {
      const shareText = `Just distributed a ${totalBounty.toLocaleString()} sat bounty to ${contributors.length} amazing contributors! 🚀

Thanks to everyone who added value to the conversation.

Powered by AI Tip & Bounty Allocator ⚡`;

      navigator.clipboard.writeText(shareText).then(() => {
        toast({
          title: "Share Text Copied",
          description: "Could not auto-post, but text is copied to clipboard. Please post it to Nostr to spread the word!",
        });
      });
    }
  };

  const renderCurrentScreen = () => {
    switch (state) {
      case 'input':
        return <InputForm onAnalyze={handleAnalyze} isLoading={false} initialNoteId={initialNoteId} />;
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
            onReset={() => setState('input')}
          />
        );
      default:
        return <InputForm onAnalyze={handleAnalyze} isLoading={false} initialNoteId={initialNoteId} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      
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