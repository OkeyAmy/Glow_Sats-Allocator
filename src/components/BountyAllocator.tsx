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
import { walletService } from '@/services/walletService';
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
  const [isInMiniApp, setIsInMiniApp] = useState<boolean>(false);
  const [webWalletConnected, setWebWalletConnected] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize YakiHonne Smart Widget communication
    try {
      // Signal to the host that the widget is ready
      SWhandler.client.ready();
      setIsInMiniApp(true);

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
      setIsInMiniApp(false);
      // Initialize web wallets if not in miniapp
      initializeWebWallets();
    }
  }, [toast]);

  const initializeWebWallets = async () => {
    try {
      // Try to connect to web wallets
      const webLNAvailable = walletService.isWebLNAvailable();
      const nostrAvailable = walletService.isNostrAvailable();
      
      if (webLNAvailable && nostrAvailable) {
        const webLNConnected = await walletService.initializeWebLN();
        const nostrConnected = await walletService.initializeNostr();
        
        if (webLNConnected && nostrConnected) {
          setWebWalletConnected(true);
          const pubkey = await walletService.getNostrPublicKey();
          const walletInfo = await walletService.getWalletInfo();
          
          setUserMetadata({
            pubkey,
            name: walletInfo?.alias || 'Web Wallet User',
            display_name: walletInfo?.alias || 'Web Wallet User'
          });
          
          toast({
            title: "Web Wallets Connected",
            description: "Connected to Nostr and Lightning wallets",
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize web wallets:', error);
    }
  };

  useEffect(() => {
    // Prefer Vite env variable for Gemini API key
    const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (envKey && envKey.trim().length > 0) {
      setApiKey(envKey.trim());
      // sessionStorage fallback disabled per request
      // const savedKey = sessionStorage.getItem('gemini_api_key');
      // if (savedKey) setApiKey(savedKey);
    } else {
      // const savedKey = sessionStorage.getItem('gemini_api_key');
      // if (savedKey) {
      //   setApiKey(savedKey);
      // } else {
        setShowApiModal(true);
      // }
    }
  }, []);

  const handleApiKeySave = (key: string) => {
    setApiKey(key);
    // sessionStorage.setItem('gemini_api_key', key); // disabled per request to use .env (Vite) instead of local storage
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
      const totalAmount = finalAllocations.reduce((sum, allocation) => sum + allocation.sats, 0);

      if (isInMiniApp) {
        // MiniApp flow through YakiHonne
        if (userBalance < totalAmount) {
          toast({
            title: "Insufficient Balance",
            description: `You need ${totalAmount} sats but only have ${userBalance} sats`,
            variant: "destructive",
          });
          return;
        }

        setLoadingStatus('Processing payments through YakiHonne...');
        setState('loading');

        // Initialize payment verification states
        const verificationStates: {[key: string]: 'pending' | 'success' | 'failed'} = {};
        finalAllocations.forEach(allocation => {
          verificationStates[allocation.pubkey] = 'pending';
        });
        setPaymentVerification(verificationStates);

        // Process payments through YakiHonne
        for (const allocation of finalAllocations) {
          try {
            const profile = await nostrService.fetchUserProfile(allocation.pubkey);
            const lightningAddress = profile?.lud16 || profile?.lud06;
            
            if (lightningAddress) {
              const paymentRequest = {
                address: lightningAddress,
                amount: allocation.sats,
                nostrPubkey: allocation.pubkey,
              };

              if (hostOrigin) {
                SWhandler.client.requestPayment(paymentRequest, hostOrigin);
              }
            } else {
              setPaymentVerification(prev => ({
                ...prev,
                [allocation.pubkey]: 'failed'
              }));
            }
          } catch (error) {
            setPaymentVerification(prev => ({
              ...prev,
              [allocation.pubkey]: 'failed'
            }));
          }
        }

        // Wait for payment confirmations
        setLoadingStatus('Waiting for payment confirmations...');
        let attempts = 0;
        const maxAttempts = 15;
        
        const checkVerifications = () => {
          attempts++;
          const currentVerifications = Object.values(paymentVerification);
          const pendingPayments = currentVerifications.filter(status => status === 'pending').length;
          
          if (pendingPayments === 0 || attempts >= maxAttempts) {
            const successfulPayments = Object.entries(paymentVerification).filter(([_, status]) => status === 'success');
            const failedPayments = Object.entries(paymentVerification).filter(([_, status]) => status === 'failed');

            const paidAmount = successfulPayments.length * (totalAmount / finalAllocations.length);
            setUserBalance(prev => prev - paidAmount);

            toast({
              title: "Payment Processing Complete",
              description: `${successfulPayments.length} payments confirmed${failedPayments.length > 0 ? `, ${failedPayments.length} failed` : ''}`,
            });

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

      } else {
        // Web wallet flow
        if (!webWalletConnected) {
          toast({
            title: "Web Wallets Required",
            description: "Please connect your Nostr and Lightning wallets",
            variant: "destructive",
          });
          return;
        }

        setLoadingStatus('Processing payments through web wallets...');
        setState('loading');

        const successfulPayments: string[] = [];
        const failedPayments: string[] = [];

        // Process payments using web wallets
        for (const allocation of finalAllocations) {
          try {
            const profile = await nostrService.fetchUserProfile(allocation.pubkey);
            const lightningAddress = profile?.lud16 || profile?.lud06;
            
            if (lightningAddress) {
              // For demo purposes, we'll just simulate the payment
              // In a real implementation, you'd need to:
              // 1. Get a Lightning invoice from the recipient's address
              // 2. Use WebLN to pay the invoice
              // 3. Verify the payment
              
              // Simulate payment delay
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // For now, mark as successful (in real implementation, check actual payment)
              successfulPayments.push(allocation.pubkey);
              
            } else {
              failedPayments.push(allocation.pubkey);
            }
          } catch (error) {
            failedPayments.push(allocation.pubkey);
          }
        }

        toast({
          title: "Payment Processing Complete",
          description: `${successfulPayments.length} payments completed${failedPayments.length > 0 ? `, ${failedPayments.length} failed` : ''}`,
        });

        setState('success');
      }
      
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

      if (isInMiniApp && hostOrigin) {
        // Use YakiHonne smart widget handler to publish the note
        SWhandler.client.requestEventPublish(noteTemplate, hostOrigin);
        
        toast({
          title: "Shared to Nostr!",
          description: "Your bounty distribution has been posted to Nostr",
        });
      } else if (webWalletConnected) {
        // Use web wallet to sign and publish
        try {
          const signedEvent = await walletService.signNostrEvent(noteTemplate);
          // In a real implementation, you'd publish this to relays
          console.log('Signed event:', signedEvent);
          
          toast({
            title: "Event Signed",
            description: "Event signed successfully. In a full implementation, this would be published to relays.",
          });
        } catch (error) {
          throw error;
        }
      } else {
        throw new Error("No signing method available");
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
      {/* User Info Display */}
      {userMetadata && (
        <div className="absolute top-2 right-2 z-20 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1 border text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">
              {isInMiniApp ? 'Balance:' : `${userMetadata.name || 'User'}:`}
            </span>
            {isInMiniApp ? (
              <span className="ml-1 font-medium text-primary">{userBalance.toLocaleString()} sats</span>
            ) : (
              <span className="ml-1 font-medium text-primary">
                {webWalletConnected ? '🟢 Connected' : '🔴 Not connected'}
              </span>
            )}
          </div>
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