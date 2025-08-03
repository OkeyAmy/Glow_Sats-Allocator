import { getPublicKey } from 'nostr-tools';

interface WebLNProvider {
  enable(): Promise<void>;
  getInfo(): Promise<{ alias: string; color?: string; pubkey?: string; }>;
  sendPayment(paymentRequest: string): Promise<{ preimage: string; }>;
  makeInvoice(args: { amount: number; defaultMemo?: string; }): Promise<{ paymentRequest: string; }>;
}

interface NostrProvider {
  getPublicKey(): Promise<string>;
  signEvent(event: any): Promise<any>;
  getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean; } }>;
  nip04?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
}

declare global {
  interface Window {
    webln?: WebLNProvider;
    nostr?: NostrProvider;
  }
}

class WalletService {
  private webln: WebLNProvider | null = null;
  private nostr: NostrProvider | null = null;

  async initializeWebLN(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.webln) {
        await window.webln.enable();
        this.webln = window.webln;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize WebLN:', error);
      return false;
    }
  }

  async initializeNostr(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.nostr) {
        this.nostr = window.nostr;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize Nostr:', error);
      return false;
    }
  }

  async getNostrPublicKey(): Promise<string | null> {
    try {
      if (!this.nostr) {
        await this.initializeNostr();
      }
      if (this.nostr) {
        return await this.nostr.getPublicKey();
      }
      return null;
    } catch (error) {
      console.error('Failed to get Nostr public key:', error);
      return null;
    }
  }

  async signNostrEvent(event: any): Promise<any> {
    try {
      if (!this.nostr) {
        await this.initializeNostr();
      }
      if (this.nostr) {
        return await this.nostr.signEvent(event);
      }
      throw new Error('Nostr provider not available');
    } catch (error) {
      console.error('Failed to sign Nostr event:', error);
      throw error;
    }
  }

  async sendLightningPayment(paymentRequest: string): Promise<{ preimage: string } | null> {
    try {
      if (!this.webln) {
        await this.initializeWebLN();
      }
      if (this.webln) {
        return await this.webln.sendPayment(paymentRequest);
      }
      return null;
    } catch (error) {
      console.error('Failed to send Lightning payment:', error);
      return null;
    }
  }

  async getLightningInvoice(amount: number, memo?: string): Promise<{ paymentRequest: string } | null> {
    try {
      if (!this.webln) {
        await this.initializeWebLN();
      }
      if (this.webln) {
        return await this.webln.makeInvoice({ amount, defaultMemo: memo });
      }
      return null;
    } catch (error) {
      console.error('Failed to get Lightning invoice:', error);
      return null;
    }
  }

  async getWalletInfo(): Promise<{ alias: string; pubkey?: string; } | null> {
    try {
      if (!this.webln) {
        await this.initializeWebLN();
      }
      if (this.webln) {
        return await this.webln.getInfo();
      }
      return null;
    } catch (error) {
      console.error('Failed to get wallet info:', error);
      return null;
    }
  }

  isWebLNAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.webln;
  }

  isNostrAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.nostr;
  }
}

export const walletService = new WalletService();
export type { WebLNProvider, NostrProvider };