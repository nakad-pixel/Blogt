const axios = require('axios');
const logger = require('./logger');

class OpenRouterClient {
  constructor() {
    this.primaryKey = process.env.OPENROUTER_KEY_A;
    this.fallbackKey = process.env.OPENROUTER_KEY_B;
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  async generateContent(prompt, model = 'meta-llama/llama-3.3-70b-instruct:free') {
    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096
      }, {
        headers: {
          'Authorization': `Bearer ${this.primaryKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('Primary OpenRouter key failed, trying fallback:', error.message);
      
      try {
        const response = await axios.post(`${this.baseUrl}/chat/completions`, {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4096
        }, {
          headers: {
            'Authorization': `Bearer ${this.fallbackKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data.choices[0].message.content;
      } catch (fallbackError) {
        logger.error('Fallback OpenRouter key failed:', fallbackError.message);
        throw new Error('OpenRouter API failed with both keys');
      }
    }
  }

  async scoreTopic(topic) {
    const scoringPrompt = `Analyze this topic for Medium publication potential:
    Topic: "${topic}"
    
    Return ONLY a JSON object with:
    - score: number (0-100) based on FES2 criteria
    - reasoning: brief explanation
    
    FES2 Criteria:
    - Engagement potential (40%)
    - Niche relevance (30%)
    - Timeliness (20%)
    - Originality (10%)
    
    Example response: {"score": 85, "reasoning": "High engagement potential in tech niche"}`;

    try {
      const result = await this.generateContent(scoringPrompt, 'google/gemma-2-9b-it:free');
      const parsed = JSON.parse(result);
      return parsed.score;
    } catch (error) {
      logger.error('Error scoring topic:', error.message);
      return 0;
    }
  }
}

module.exports = OpenRouterClient;