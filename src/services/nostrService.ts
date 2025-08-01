import { SimplePool, Filter, Event, nip19 } from 'nostr-tools';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://nostr.wine'
];

interface NostrNote {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  author?: {
    name?: string;
    display_name?: string;
  };
}

class NostrService {
  private pool: SimplePool;

  constructor() {
    this.pool = new SimplePool();
  }

  private processNoteId(noteId: string): { id: string; relays?: string[] } {
    // Remove any whitespace
    noteId = noteId.trim();
    
    try {
      // Check if it's a bech32 encoded identifier
      if (noteId.startsWith('note1') || noteId.startsWith('nevent1')) {
        const decoded = nip19.decode(noteId);
        
        if (decoded.type === 'note') {
          return { id: decoded.data };
        } else if (decoded.type === 'nevent') {
          return { 
            id: decoded.data.id,
            relays: decoded.data.relays 
          };
        }
      }
      
      // If it's already a hex string, validate it
      if (/^[a-fA-F0-9]{64}$/.test(noteId)) {
        return { id: noteId };
      }
      
      throw new Error('Invalid note ID format');
    } catch (error) {
      throw new Error(`Invalid note ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchThreadReplies(noteId: string): Promise<NostrNote[]> {
    try {
      const { id: hexId, relays } = this.processNoteId(noteId);
      const targetRelays = relays && relays.length > 0 ? [...relays, ...RELAYS] : RELAYS;
      
      const filter: Filter = {
        kinds: [1],
        '#e': [hexId],
        limit: 100
      };

      const events = await this.pool.querySync(targetRelays, filter);
      
      // Get unique pubkeys for author info
      const uniquePubkeys = [...new Set(events.map(e => e.pubkey))];
      const authorFilter: Filter = {
        kinds: [0],
        authors: uniquePubkeys
      };

      const authorEvents = await this.pool.querySync(RELAYS, authorFilter);
      const authorMap = new Map();
      
      authorEvents.forEach(event => {
        try {
          const profile = JSON.parse(event.content);
          authorMap.set(event.pubkey, profile);
        } catch (e) {
          // Ignore malformed profiles
        }
      });

      const notes: NostrNote[] = events
        .sort((a, b) => b.created_at - a.created_at)
        .map(event => ({
          id: event.id,
          pubkey: event.pubkey,
          content: event.content,
          created_at: event.created_at,
          author: authorMap.get(event.pubkey)
        }));

      return notes;
    } catch (error) {
      console.error('Error fetching Nostr thread:', error);
      throw new Error('Failed to fetch thread data');
    }
  }

  async fetchOriginalNote(noteId: string): Promise<NostrNote | null> {
    try {
      const { id: hexId, relays } = this.processNoteId(noteId);
      const targetRelays = relays && relays.length > 0 ? [...relays, ...RELAYS] : RELAYS;
      
      const filter: Filter = {
        kinds: [1],
        ids: [hexId]
      };

      const events = await this.pool.querySync(targetRelays, filter);
      if (events.length === 0) return null;

      const event = events[0];
      
      // Get author info
      const authorFilter: Filter = {
        kinds: [0],
        authors: [event.pubkey]
      };

      const authorEvents = await this.pool.querySync(RELAYS, authorFilter);
      let author;
      
      if (authorEvents.length > 0) {
        try {
          author = JSON.parse(authorEvents[0].content);
        } catch (e) {
          // Ignore malformed profile
        }
      }

      return {
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
        created_at: event.created_at,
        author
      };
    } catch (error) {
      console.error('Error fetching original note:', error);
      return null;
    }
  }

  formatThreadForAI(originalNote: NostrNote, replies: NostrNote[]): string {
    let prompt = `ORIGINAL POST:\n`;
    prompt += `Author: ${originalNote.author?.display_name || originalNote.author?.name || 'Anonymous'}\n`;
    prompt += `Content: ${originalNote.content}\n\n`;
    
    prompt += `REPLIES (${replies.length} total):\n\n`;
    
    replies.forEach((reply, index) => {
      prompt += `Reply ${index + 1}:\n`;
      prompt += `Author: ${reply.author?.display_name || reply.author?.name || 'Anonymous'}\n`;
      prompt += `Content: ${reply.content}\n`;
      prompt += `Pubkey: ${reply.pubkey}\n\n`;
    });

    return prompt;
  }

  async publishNote(noteEvent: any): Promise<Event | null> {
    try {
      // In a real implementation, you would need to sign the event
      // This requires user's private key or a browser extension like Alby
      if (typeof window !== 'undefined' && (window as any).nostr) {
        const signedEvent = await (window as any).nostr.signEvent(noteEvent);
        await Promise.all(this.pool.publish(RELAYS, signedEvent));
        return signedEvent;
      }
      return null;
    } catch (error) {
      console.error('Error publishing note:', error);
      return null;
    }
  }

  close() {
    this.pool.close(RELAYS);
  }
}

export const nostrService = new NostrService();
export type { NostrNote };