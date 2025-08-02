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
import SWhandler from 'smart-widget-handler';
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
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [hostOrigin, setHostOrigin] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // Initialize YakiHonne Smart Widget communication
    try {
      // Signal to the host that the widget is ready
      SWhandler.client.ready();

      // Listen for messages from the host
      const listener = SWhandler.client.listen((event: any) => {
        console.log('Received message from host:', event);

        if (event.kind === 'user-metadata') {
          setUserMetadata(event.data?.user);
          setHostOrigin(event.data?.host_origin || '');
          toast({
            title: "Connected to Nostr client",
            description: `Welcome ${event.data?.user?.display_name || event.data?.user?.name || 'user'}!`,
          });
        }

        // Handle note ID if passed from context
        if (event.data?.noteId) {
          setInitialNoteId(event.data.noteId);
          toast({
            title: "Note ID Received",
            description: "Pre-filled from Nostr client",
          });
        }

        if (event.kind === 'err-msg') {
          toast({
            title: "Error from host",
            description: event.data,
            variant: "destructive",
          });
        }
      });

      return () => listener?.close();
    } catch (error) {
      console.info("Not running in a widget context.");
    }
  }, [toast]);

  useEffect(() => {
    // This effect handles application-specific logic after the component mounts.
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
      // Process payments through YakiHonne zap functionality
      setLoadingStatus('Processing payments...');
      setState('loading');

      // Fetch contributor lightning addresses from their profiles
      const paymentPromises = finalAllocations.map(async (allocation) => {
        try {
          // Get contributor profile to find lightning address
          const profile = await nostrService.fetchUserProfile(allocation.pubkey);
          const lightningAddress = profile?.lud16 || profile?.lud06;
          
          if (lightningAddress) {
            // Request payment through YakiHonne host
            const paymentRequest = {
              address: lightningAddress,
              amount: allocation.sats,
              nostrPubkey: allocation.pubkey,
            };

            // Use smart widget handler to request payment
            if (hostOrigin) {
              SWhandler.client.requestPayment(paymentRequest, hostOrigin);
            }
            
            return { success: true, pubkey: allocation.pubkey, sats: allocation.sats };
          } else {
            console.warn(`No lightning address found for ${allocation.pubkey}`);
            return { success: false, pubkey: allocation.pubkey, sats: allocation.sats, reason: 'No lightning address' };
          }
        } catch (error) {
          console.error(`Failed to process payment for ${allocation.pubkey}:`, error);
          return { success: false, pubkey: allocation.pubkey, sats: allocation.sats, reason: 'Payment error' };
        }
      });

      const paymentResults = await Promise.all(paymentPromises);
      const successfulPayments = paymentResults.filter(r => r.success);
      const failedPayments = paymentResults.filter(r => !r.success);

      toast({
        title: "Payment Processing Complete",
        description: `${successfulPayments.length} payments sent successfully${failedPayments.length > 0 ? `, ${failedPayments.length} failed` : ''}`,
      });

      // Send results back to parent Nostr client
      if (hostOrigin) {
        SWhandler.client.sendContext(JSON.stringify({
          action: 'bounty_distributed',
          results: {
            totalSats: totalBounty,
            contributors: finalAllocations,
            originalNoteId: originalNote?.id,
            distributionComplete: true,
            paymentResults
          }
        }), hostOrigin);
      }
      
      setState('success');
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "Could not process Lightning payments",
        variant: "destructive",
      });
      setState('recommendations');
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

      // Use YakiHonne smart widget handler to publish the note
      if (hostOrigin) {
        SWhandler.client.requestEventPublish(noteTemplate, hostOrigin);
        
        toast({
          title: "Shared to Nostr!",
          description: "Your bounty distribution has been posted to Nostr",
        });
      } else {
        throw new Error("No host connection available");
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