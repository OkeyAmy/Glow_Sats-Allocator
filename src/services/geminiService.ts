interface Contributor {
  name: string;
  pubkey: string;
  contribution: string;
  recommendedSats: number;
  aiJustification: string;
}

interface GeminiResponse {
  contributors: Contributor[];
  reasoning: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

class GeminiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chatWithAI(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            contents: messages,
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 100,
            },
            safetySettings: [
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates[0]?.content?.parts[0]?.text;
      
      if (!aiResponse) {
        throw new Error('Empty response from Gemini');
      }

      return aiResponse;
    } catch (error) {
      console.error('Gemini chat error:', error);
      throw new Error('Failed to get response from AI');
    }
  }

  async analyzeThread(threadContent: string, totalBounty: number, customDistribution?: number): Promise<GeminiResponse> {
    const prompt = this.buildPrompt(threadContent, totalBounty, customDistribution);
    
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.4,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates[0]?.content?.parts[0]?.text;
      
      if (!aiResponse) {
        throw new Error('Empty response from Gemini');
      }

      return this.parseAIResponse(aiResponse);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to analyze thread with AI');
    }
  }

  private buildPrompt(threadContent: string, totalBounty: number, customDistribution?: number): string {
    return `You are a sophisticated **Nostr Analyst AI**. Your **sole mission** is to objectively analyze a conversation thread and recommend a fair distribution of a ${totalBounty} sat bounty. 

Analyze the following thread and determine how to allocate the bounty based on the following **Value Criteria**:
1. **Problem Solving:** Did the reply directly answer a question or solve a problem posted in the thread?
2. **Novelty & Insight:** Did the reply introduce a new, valuable idea or a unique, insightful perspective?
3. **Constructive Argument:** Did the reply constructively challenge, build upon, or add significant nuance to previous points?
4. **Data Provision:** Did the reply provide a useful link, data, source, or verifiable evidence that enriched the conversation?


Thread content:
${threadContent}

Instructions:
- Only include replies that add genuine value
- Only select the relevant contributors to the orignal tweets if no relevant repy pick the most relvant keep it few to avoid noise reply
- Exclude simple reactions like "thanks" or single emoji responses
- Prioritize substantive, helpful, or insightful contributions
- Consider the effort and thought put into each response
- The total allocation should equal ${totalBounty} sats
- The minimum allocation for any included contributor should be at least 1 sat.${customDistribution ? `\n- Your analysis should focus primarily on identifying the top ${customDistribution} most valuable contributors.` : ''}
- **Negative Keywords:** Explicitly ignore and assign zero sats to replies consisting solely of simple praise, agreement, or basic questions (e.g., "gm", "this", "great point!", "I agree", "what does that mean?").
- Prioritize substantive, helpful, or insightful contributions that demonstrably meet the Value Criteria.
- Consider the effort and thought put into each response.


Return your analysis as a JSON object with this exact structure:
{
  "contributors": [
    {
      "name": "Author display name or 'Anonymous'",
      "pubkey": "full pubkey from the reply",
      "contribution": "brief description of their contribution(must be the raw reply. For links or any long word emebd them into shorter text for example "nostr:nevent1qqsvaut2vxl5x5l2t95e7e25dnw3vl4668tmmy0t6726eyu8w4tcptsp9dmhxue69uhhyet" should now be written like this "nostr... thank")",
      "recommendedSats": number,
      "aiJustification": "why this person deserves this amount (1-2 sentences)"
    }
  ],
  "reasoning": "overall reasoning for the allocation strategy.Overall summary of your allocation strategy and why you chose the top contributors."
}

IMPORTANT: 
- Only return valid JSON, no other text
- Include only contributors who genuinely added value
- **Critical Calculation:** The sum of all \`recommendedSats\` values in the \`contributors\` array **must equal exactly** ${totalBounty}. Double-check your math before responding.
- Ensure the total sats add up to exactly ${totalBounty}
- Use the exact pubkey from each reply`;
  }

  private parseAIResponse(response: string): GeminiResponse {
    try {
      // Clean the response to extract JSON
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = response.slice(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonStr);

      // Validate the structure
      if (!parsed.contributors || !Array.isArray(parsed.contributors)) {
        throw new Error('Invalid response structure');
      }

      return parsed as GeminiResponse;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('Invalid AI response format');
    }
  }
}

export { GeminiService };
export type { Contributor, GeminiResponse, ChatMessage };
