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
      if (noteId.startsWith('note1') || noteId.startsWith('nevent1') || noteId.startsWith('naddr1')) {
        const decoded = nip19.decode(noteId);
        
        if (decoded.type === 'note') {
          return { id: decoded.data };
        } else if (decoded.type === 'nevent') {
          return { 
            id: decoded.data.id,
            relays: decoded.data.relays 
          };
        } else if (decoded.type === 'naddr') {
          // For naddr, we need to construct the event ID from the identifier
          // For now, we'll use the identifier as the tag value to search for
          return { 
            id: decoded.data.identifier || decoded.data.pubkey,
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

      // Resolve the true root id for the thread (if input is a reply nevent)
      let rootId = hexId;
      try {
        const rootLookup = await this.pool.querySync(targetRelays, {
          kinds: [1],
          ids: [hexId],
          limit: 1,
        });
        if (rootLookup.length > 0) {
          const ev = rootLookup[0];
          const eTags = (ev.tags || []).filter((t) => t[0] === 'e');
          const tagWithRootMarker = eTags.find((t) => t[3] === 'root');
          const firstETag = eTags[0];
          const candidate = tagWithRootMarker?.[1] || firstETag?.[1];
          if (candidate && /^[a-fA-F0-9]{64}$/.test(candidate)) {
            rootId = candidate;
          }
        }
      } catch {
        // ignore and use provided id
      }

      // Recursively fetch replies to the root and to replies (nested)
      const MAX_DEPTH = 2; // root scan plus one nested depth is often enough; root scan already pulls most
      const PER_QUERY_LIMIT = 500; // per-batch limit
      const MAX_TOTAL = 2000; // safety cap

      const seenEventIds = new Set<string>();
      const collected: Event[] = [];

      // Start with the resolved root id
      let currentIds: string[] = [rootId];
      for (let depth = 0; depth < MAX_DEPTH && currentIds.length > 0 && collected.length < MAX_TOTAL; depth++) {
        // Batch ids to avoid overly large filters
        const nextLevelIds: string[] = [];

        const batches: string[][] = [];
        const BATCH_SIZE = 150;
        for (let i = 0; i < currentIds.length; i += BATCH_SIZE) {
          batches.push(currentIds.slice(i, i + BATCH_SIZE));
        }

        for (const batch of batches) {
          const filter: Filter = {
            kinds: [1],
            '#e': batch,
            limit: PER_QUERY_LIMIT,
          };

          const events = await this.pool.querySync(targetRelays, filter);

          for (const ev of events) {
            if (!seenEventIds.has(ev.id)) {
              seenEventIds.add(ev.id);
              collected.push(ev);
              // Queue this event id to find replies to it in the next depth
              nextLevelIds.push(ev.id);
              if (collected.length >= MAX_TOTAL) break;
            }
          }

          if (collected.length >= MAX_TOTAL) break;
        }

        currentIds = nextLevelIds;
      }

      // Get unique pubkeys for author info
      const uniquePubkeys = [...new Set(collected.map(e => e.pubkey))];
      const authorFilter: Filter = {
        kinds: [0],
        authors: uniquePubkeys
      };

      const authorEvents = await this.pool.querySync(RELAYS, authorFilter);
      const authorMap = new Map<string, any>();

      authorEvents.forEach(event => {
        try {
          const profile = JSON.parse(event.content);
          authorMap.set(event.pubkey, profile);
        } catch {
          // Ignore malformed profiles
        }
      });

      const notes: NostrNote[] = collected
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

      // If this event is a reply, prefer to return its root for top-level display
      try {
        const eTags = (event.tags || []).filter((t) => t[0] === 'e');
        const tagWithRootMarker = eTags.find((t) => t[3] === 'root');
        const firstETag = eTags[0];
        const candidateRoot = tagWithRootMarker?.[1] || firstETag?.[1];
        if (candidateRoot && /^[a-fA-F0-9]{64}$/.test(candidateRoot)) {
          const rootEvents = await this.pool.querySync(targetRelays, { kinds: [1], ids: [candidateRoot], limit: 1 });
          if (rootEvents.length > 0) {
            // Use the root note instead
            const rootEv = rootEvents[0];
            event.id = rootEv.id;
            event.pubkey = rootEv.pubkey;
            event.content = rootEv.content;
            event.created_at = rootEv.created_at;
            event.tags = rootEv.tags;
          }
        }
      } catch {
        // ignore
      }
      
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
      prompt += `Pubkey: ${reply.pubkey}\n`;
      prompt += `EventId: ${reply.id}\n\n`;
    });

    return prompt;
  }

  async fetchUserProfile(pubkey: string): Promise<any> {
    try {
      const filter: Filter = {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      };

      const events = await this.pool.querySync(RELAYS, filter);
      
      if (events.length > 0) {
        try {
          return JSON.parse(events[0].content);
        } catch (e) {
          console.error('Failed to parse user profile:', e);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  close() {
    this.pool.close(RELAYS);
  }
}

export const nostrService = new NostrService();
export type { NostrNote };