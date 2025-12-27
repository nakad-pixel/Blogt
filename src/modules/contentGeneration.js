const OpenRouterClient = require('../utils/openrouter');
const logger = require('../utils/logger');
const fleschKincaid = require('flesch-kincaid');

class ContentGeneration {
  constructor() {
    this.openrouter = new OpenRouterClient();
  }

  async generateArticle(topic) {
    try {
      // Generate content with specific requirements
      const prompt = this.createContentPrompt(topic);
      let content = await this.openrouter.generateContent(prompt);
      
      // Humanize the content
      content = this.humanizeContent(content);
      
      // Validate readability
      const readabilityScore = this.calculateReadability(content);
      
      if (readabilityScore < 65) {
        logger.warn(`Readability score too low (${readabilityScore}), regenerating...`);
        content = await this.regenerateForReadability(topic, content);
      }
      
      // Validate length
      const wordCount = content.split(/\s+/).length;
      if (wordCount < 1300 || wordCount > 1800) {
        logger.warn(`Word count out of range (${wordCount}), adjusting...`);
        content = await this.adjustLength(content, wordCount);
      }
      
      return {
        title: this.extractTitle(content),
        content: content,
        wordCount: wordCount,
        readabilityScore: readabilityScore,
        metadata: {
          topic: topic,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Content generation failed:', error.message);
      throw error;
    }
  }

  createContentPrompt(topic) {
    return `Write a comprehensive Medium article about "${topic}". Follow these requirements:
    
    1. Length: 1300-1800 words
    2. Structure: Clear introduction, 3-5 main sections with subheadings, conclusion
    3. Style: Professional yet conversational, use "you" and "we" to engage reader
    4. Technical depth: Include specific examples, code snippets if relevant, data points
    5. Readability: Aim for Flesch-Kincaid score > 65
    6. Engagement: End with a question or call-to-action
    7. Formatting: Use Markdown formatting
    8. Originality: Do not copy from existing sources
    
    Start with an engaging title, then write the full article content. Use variable sentence length and include idiosyncratic transitions between ideas.`;
  }

  humanizeContent(content) {
    // Add variable sentence length
    const sentences = content.split(/[.!?]+/);
    const humanizedSentences = sentences.map(sentence => {
      if (Math.random() < 0.2) {
        // 20% chance to make sentence longer
        return sentence + `, which means that ${this.generateTransition()}`;
      }
      return sentence;
    });
    
    // Add technical jargon where appropriate
    const withJargon = humanizedSentences.map(sentence => {
      if (Math.random() < 0.15 && sentence.length > 50) {
        return sentence + ` (${this.generateTechnicalTerm()})`;
      }
      return sentence;
    });
    
    return withJargon.join('. ');
  }

  generateTransition() {
    const transitions = [
      'has significant implications for the broader ecosystem',
      'represents a fundamental shift in how we approach this problem',
      'is particularly relevant when considering the current landscape',
      'demonstrates the underlying complexity of modern systems',
      'highlights an often-overlooked aspect of the discussion'
    ];
    return transitions[Math.floor(Math.random() * transitions.length)];
  }

  generateTechnicalTerm() {
    const terms = [
      'paradigm shift', 'cognitive load', 'asynchronous processing',
      'declarative approach', 'idempotent operations', 'event-driven architecture'
    ];
    return terms[Math.floor(Math.random() * terms.length)];
  }

  calculateReadability(text) {
    try {
      const result = fleschKincaid(text);
      return result.score;
    } catch (error) {
      logger.error('Readability calculation failed:', error.message);
      return 60; // Default to borderline acceptable
    }
  }

  async regenerateForReadability(topic, originalContent) {
    const improvementPrompt = `Improve the readability of this article about "${topic}". 
    Current content: "${originalContent.substring(0, 2000)}..."
    
    Requirements:
    - Maintain all key information and structure
    - Increase Flesch-Kincaid readability score to > 65
    - Use simpler words and shorter sentences
    - Keep professional tone
    - Maintain 1300-1800 word length
    
    Return the improved article:`;
    
    return await this.openrouter.generateContent(improvementPrompt);
  }

  async adjustLength(content, currentWordCount) {
    if (currentWordCount < 1300) {
      // Need to expand
      const expansionPrompt = `Expand this article to 1300-1800 words while maintaining quality:
      "${content.substring(0, 2000)}..."
      
      Add more examples, deeper explanations, and additional relevant sections.`;
      return await this.openrouter.generateContent(expansionPrompt);
    } else {
      // Need to shorten
      const shorteningPrompt = `Condense this article to 1300-1800 words while preserving key information:
      "${content.substring(0, 2000)}..."
      
      Remove redundancy, simplify explanations, and focus on core value.`;
      return await this.openrouter.generateContent(shorteningPrompt);
    }
  }

  extractTitle(content) {
    // Extract title from content (first line or h1)
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('# ')) {
        return line.substring(2).trim();
      }
      if (line.length > 10 && line.length < 80 && !line.includes(' ')) {
        return line.trim();
      }
    }
    
    // Fallback: generate title from topic
    return `Understanding ${topic}: A Comprehensive Guide`;
  }
}

module.exports = ContentGeneration;