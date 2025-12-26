import fetch from 'node-fetch';
import config from '../../config/default.js';
import logger from '../utils/logger.js';
import security from '../utils/security.js';
import errorHandler, { BlogtError, ERROR_CATEGORIES } from '../utils/errorHandler.js';

class ContentGenerator {
  constructor() {
    this.apiKey = null;
  }

  initialize() {
    this.apiKey = security.getSecret('OPENROUTER_API_KEY');
    logger.info('Content generator initialized');
  }

  async callOpenRouter(prompt, systemPrompt = null) {
    const messages = [];
    
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    const payload = {
      model: config.openrouter.model,
      messages,
      max_tokens: config.openrouter.max_tokens,
      temperature: config.openrouter.temperature
    };

    logger.info('Calling OpenRouter API...', {
      model: config.openrouter.model,
      prompt_length: prompt.length
    });

    try {
      const response = await fetch(config.openrouter.api_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/blogt',
          'X-Title': 'Blogt Automation'
        },
        body: JSON.stringify(payload),
        timeout: config.timeouts.content_generation
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new BlogtError(
          `OpenRouter API error: ${response.status} - ${errorText}`,
          ERROR_CATEGORIES.API_FAILURE,
          null,
          true
        );
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new BlogtError(
          'No response from OpenRouter',
          ERROR_CATEGORIES.API_FAILURE,
          null,
          true
        );
      }

      const content = data.choices[0].message.content;
      logger.info('OpenRouter response received', {
        content_length: content.length,
        tokens_used: data.usage?.total_tokens || 'unknown'
      });

      return content;

    } catch (error) {
      if (error instanceof BlogtError) {
        throw error;
      }
      throw new BlogtError(
        `Failed to call OpenRouter: ${error.message}`,
        ERROR_CATEGORIES.API_FAILURE,
        error,
        true
      );
    }
  }

  extractTitleFromContent(content) {
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const cleaned = line.replace(/^#+\s*/, '').trim();
      if (cleaned.length > 20 && cleaned.length < 150 && !cleaned.includes('\n')) {
        return cleaned;
      }
    }

    return lines[0]?.replace(/^#+\s*/, '').trim() || 'Untitled Article';
  }

  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  estimateReadability(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => {
      return count + this.countSyllables(word);
    }, 0);

    if (sentences.length === 0 || words.length === 0) {
      return 0;
    }

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

    return Math.max(0, Math.min(100, Math.round(fleschScore)));
  }

  countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    
    return matches ? matches.length : 1;
  }

  estimateHumanization(text) {
    let score = 100;

    const repetitivePatterns = [
      /\b(\w+)\s+\1\b/gi,
      /\b(very|really|quite|just)\b/gi,
      /\b(utilize|leverage|facilitate)\b/gi
    ];

    repetitivePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        score -= matches.length * 2;
      }
    });

    const avgSentenceLength = text.split(/[.!?]+/).filter(s => s.trim()).length;
    const wordCount = this.countWords(text);
    const avgWords = avgSentenceLength > 0 ? wordCount / avgSentenceLength : 0;
    
    if (avgWords > 25) {
      score -= 10;
    } else if (avgWords < 10) {
      score -= 5;
    }

    const hasVariety = /[!?]/.test(text);
    if (hasVariety) {
      score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  validateContent(content, title) {
    const wordCount = this.countWords(content);
    const readability = this.estimateReadability(content);
    const humanization = this.estimateHumanization(content);

    const validation = {
      valid: true,
      wordCount,
      readability,
      humanization,
      errors: []
    };

    if (wordCount < config.content.min_words) {
      validation.valid = false;
      validation.errors.push(`Word count too low: ${wordCount} < ${config.content.min_words}`);
    }

    if (wordCount > config.content.max_words) {
      validation.valid = false;
      validation.errors.push(`Word count too high: ${wordCount} > ${config.content.max_words}`);
    }

    if (readability < config.content.min_readability) {
      validation.valid = false;
      validation.errors.push(`Readability too low: ${readability} < ${config.content.min_readability}`);
    }

    if (humanization < config.content.min_humanization) {
      validation.valid = false;
      validation.errors.push(`Humanization too low: ${humanization} < ${config.content.min_humanization}`);
    }

    if (!title || title.length < 10) {
      validation.valid = false;
      validation.errors.push('Title too short');
    }

    logger.info('Content validation:', validation);

    return validation;
  }

  async generate(topic, researchBrief = '') {
    try {
      logger.section('CONTENT GENERATION');
      logger.info(`Generating content for topic: ${topic}`);

      if (!this.apiKey) {
        this.initialize();
      }

      const prompt = `Topic: ${topic}

${researchBrief ? `Research Brief:\n${researchBrief}\n\n` : ''}

Write a comprehensive, engaging article on this topic following the structure and requirements outlined in your system prompt.

Focus on:
- Practical, actionable insights
- Specific AI tools and how to use them
- Real-world examples and use cases
- Clear decision-making guidance
- Natural, conversational tone

Begin with a compelling title (as a heading), then write the article.`;

      let attempt = 1;
      const maxAttempts = 3;

      while (attempt <= maxAttempts) {
        logger.info(`Generation attempt ${attempt}/${maxAttempts}`);

        const content = await this.callOpenRouter(
          prompt,
          config.prompts.content_generation
        );

        const title = this.extractTitleFromContent(content);
        const validation = this.validateContent(content, title);

        if (validation.valid) {
          logger.info('Content generation successful!', {
            title,
            word_count: validation.wordCount,
            readability: validation.readability,
            humanization: validation.humanization
          });

          return {
            title,
            content,
            word_count: validation.wordCount,
            readability_score: validation.readability,
            humanization_score: validation.humanization
          };
        }

        logger.warn(`Attempt ${attempt} failed validation:`, validation.errors);

        if (attempt < maxAttempts) {
          logger.info('Regenerating content with adjusted parameters...');
          await errorHandler.sleep(2000);
        }

        attempt++;
      }

      throw new BlogtError(
        'Failed to generate valid content after maximum attempts',
        ERROR_CATEGORIES.CONTENT_VALIDATION_FAILURE,
        null,
        false
      );

    } catch (error) {
      if (error instanceof BlogtError) {
        throw error;
      }
      throw errorHandler.handle(error, 'Content Generation');
    }
  }

  async generateTitle(topic) {
    try {
      const prompt = `Generate a compelling, click-worthy blog post title for this topic: "${topic}"

Requirements:
- Between 40-80 characters
- Include a power word (Best, Ultimate, Complete, Essential, etc.)
- Make it specific and actionable
- Focus on the benefit or outcome
- No clickbait or misleading language

Return ONLY the title, nothing else.`;

      const title = await this.callOpenRouter(prompt);
      return title.trim().replace(/^["']|["']$/g, '');

    } catch (error) {
      logger.error(`Failed to generate title: ${error.message}`);
      return topic;
    }
  }
}

const contentGenerator = new ContentGenerator();

export default contentGenerator;
