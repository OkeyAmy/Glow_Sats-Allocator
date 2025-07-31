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

class GeminiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeThread(threadContent: string, totalBounty: number): Promise<GeminiResponse> {
    const prompt = this.buildPrompt(threadContent, totalBounty);
    
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
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
            }]
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

  private buildPrompt(threadContent: string, totalBounty: number): string {
    return `You are an AI assistant helping to fairly distribute a ${totalBounty} sat bounty among contributors to a Nostr thread. 

Analyze the following thread and determine how to allocate the bounty based on:
1. Quality and depth of contributions
2. Helpfulness to the original poster
3. Originality and insight
4. Engagement value

Thread content:
${threadContent}

Instructions:
- Only include replies that add genuine value
- Exclude simple reactions like "thanks" or single emoji responses
- Prioritize substantive, helpful, or insightful contributions
- Consider the effort and thought put into each response
- The total allocation should equal ${totalBounty} sats
- Minimum allocation for included contributors should be 100 sats

Return your analysis as a JSON object with this exact structure:
{
  "contributors": [
    {
      "name": "Author display name or 'Anonymous'",
      "pubkey": "full pubkey from the reply",
      "contribution": "brief description of their contribution",
      "recommendedSats": number,
      "aiJustification": "why this person deserves this amount (1-2 sentences)"
    }
  ],
  "reasoning": "overall reasoning for the allocation strategy"
}

IMPORTANT: 
- Only return valid JSON, no other text
- Include only contributors who genuinely added value
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
export type { Contributor, GeminiResponse };