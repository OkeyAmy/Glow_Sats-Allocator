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
  const [userBalance, setUserBalance] = useState<number>(0);
  const [paymentVerification, setPaymentVerification] = useState<{[key: string]: 'pending' | 'success' | 'failed'}>({});
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
          const user = event.data?.user;
          setUserMetadata(user);
          setHostOrigin(event.data?.host_origin || '');
          setUserBalance(user?.balance || 0);
          toast({
            title: "Connected to Nostr client",
            description: `Welcome ${user?.display_name || user?.name || 'user'}!`,
          });
        }

        if (event.kind === 'payment-response') {
          const response = event.data;
          const pubkey = response.nostrPubkey;
          if (pubkey) {
            setPaymentVerification(prev => ({
              ...prev,
              [pubkey]: response.status ? 'success' : 'failed'
            }));
          }
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
      // Check if user has sufficient balance
      const totalAmount = finalAllocations.reduce((sum, allocation) => sum + allocation.sats, 0);
      if (userBalance < totalAmount) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${totalAmount} sats but only have ${userBalance} sats`,
          variant: "destructive",
        });
        return;
      }

      // Process payments through YakiHonne zap functionality
      setLoadingStatus('Processing payments...');
      setState('loading');

      // Initialize payment verification states
      const verificationStates: {[key: string]: 'pending' | 'success' | 'failed'} = {};
      finalAllocations.forEach(allocation => {
        verificationStates[allocation.pubkey] = 'pending';
      });
      setPaymentVerification(verificationStates);

      // Fetch contributor lightning addresses and request payments
      for (const allocation of finalAllocations) {
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
          } else {
            console.warn(`No lightning address found for ${allocation.pubkey}`);
            setPaymentVerification(prev => ({
              ...prev,
              [allocation.pubkey]: 'failed'
            }));
          }
        } catch (error) {
          console.error(`Failed to process payment for ${allocation.pubkey}:`, error);
          setPaymentVerification(prev => ({
            ...prev,
            [allocation.pubkey]: 'failed'
          }));
        }
      }

      // Wait for all payment verifications
      setLoadingStatus('Waiting for payment confirmations...');
      
      // Check verification status every 2 seconds for up to 30 seconds
      let attempts = 0;
      const maxAttempts = 15;
      
      const checkVerifications = () => {
        attempts++;
        const currentVerifications = Object.values(paymentVerification);
        const pendingPayments = currentVerifications.filter(status => status === 'pending').length;
        
        if (pendingPayments === 0 || attempts >= maxAttempts) {
          // All payments processed or timeout
          const successfulPayments = Object.entries(paymentVerification).filter(([_, status]) => status === 'success');
          const failedPayments = Object.entries(paymentVerification).filter(([_, status]) => status === 'failed');

          // Update user balance
          const paidAmount = successfulPayments.length * (totalAmount / finalAllocations.length);
          setUserBalance(prev => prev - paidAmount);

          toast({
            title: "Payment Processing Complete",
            description: `${successfulPayments.length} payments confirmed${failedPayments.length > 0 ? `, ${failedPayments.length} failed` : ''}`,
          });

          // Send results back to parent Nostr client
          if (hostOrigin) {
            SWhandler.client.sendContext(JSON.stringify({
              action: 'bounty_distributed',
              results: {
                totalSats: totalAmount,
                contributors: finalAllocations,
                originalNoteId: originalNote?.id,
                distributionComplete: true,
                paymentResults: {
                  successful: successfulPayments.length,
                  failed: failedPayments.length
                }
              }
            }), hostOrigin);
          }
          
          setState('success');
        } else {
          setTimeout(checkVerifications, 2000);
        }
      };

      setTimeout(checkVerifications, 2000);
      
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
    <div className="w-full h-full max-w-full max-h-full overflow-hidden">
      {/* User Balance Display */}
      {userMetadata && (
        <div className="absolute top-2 right-2 z-20 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1 border text-sm">
          <span className="text-muted-foreground">Balance:</span>
          <span className="ml-1 font-medium text-primary">{userBalance.toLocaleString()} sats</span>
        </div>
      )}
      
      <div className="relative w-full h-full flex items-center justify-center p-2">
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
            className="w-full h-full max-w-full max-h-full"
          >
            {renderCurrentScreen()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BountyAllocator;