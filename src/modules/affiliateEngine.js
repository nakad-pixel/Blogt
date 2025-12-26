import fetch from 'node-fetch';
import config from '../../config/default.js';
import logger from '../utils/logger.js';
import stateManager from '../utils/stateManager.js';
import errorHandler from '../utils/errorHandler.js';

class AffiliateEngine {
  constructor() {
    this.linkCache = new Map();
  }

  async checkLinkStatus(url) {
    if (this.linkCache.has(url)) {
      return this.linkCache.get(url);
    }

    try {
      logger.info(`Checking link status: ${url}`);
      
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: 10000,
        redirect: 'follow'
      });

      const isValid = response.ok;
      this.linkCache.set(url, isValid);

      logger.info(`Link ${url}: ${isValid ? 'VALID' : 'INVALID'} (${response.status})`);
      
      return isValid;

    } catch (error) {
      logger.warn(`Failed to check link ${url}: ${error.message}`);
      this.linkCache.set(url, false);
      return false;
    }
  }

  async validateLinks(links) {
    const validated = [];

    for (const link of links) {
      const isValid = await this.checkLinkStatus(link.url);
      
      if (isValid) {
        validated.push(link);
      } else {
        logger.warn(`Removing invalid link: ${link.name} (${link.url})`);
      }

      await errorHandler.sleep(500);
    }

    return validated;
  }

  selectRelevantLinks(topic, availableLinks, maxLinks = 3) {
    const topicLower = topic.toLowerCase();
    
    const relevanceScores = availableLinks.map(link => {
      let score = 0;
      const nameLower = link.name.toLowerCase();
      const categoryLower = link.category.toLowerCase();

      if (topicLower.includes(nameLower)) {
        score += 50;
      }

      const categoryKeywords = {
        llm: ['language', 'chat', 'gpt', 'conversation', 'text', 'writing'],
        image_generation: ['image', 'visual', 'art', 'design', 'creative'],
        automation: ['automation', 'workflow', 'productivity', 'task'],
        analytics: ['data', 'analytics', 'insights', 'metrics', 'analysis']
      };

      const keywords = categoryKeywords[link.category] || [];
      keywords.forEach(keyword => {
        if (topicLower.includes(keyword)) {
          score += 10;
        }
      });

      if (score === 0) {
        score = 5;
      }

      return { link, score };
    });

    relevanceScores.sort((a, b) => b.score - a.score);

    const selected = relevanceScores.slice(0, maxLinks).map(item => item.link);
    
    logger.info(`Selected ${selected.length} affiliate links:`, 
      selected.map(l => `${l.name} (score: ${relevanceScores.find(r => r.link === l).score})`)
    );

    return selected;
  }

  findInsertionPoints(content, linkCount) {
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 100);
    
    if (paragraphs.length < linkCount) {
      logger.warn(`Not enough paragraphs for ${linkCount} links, using ${paragraphs.length}`);
      linkCount = paragraphs.length;
    }

    const step = Math.floor(paragraphs.length / (linkCount + 1));
    const positions = [];

    for (let i = 1; i <= linkCount; i++) {
      positions.push(step * i);
    }

    return positions;
  }

  createAffiliateLink(link, context = '') {
    const templates = [
      `Check out [${link.name}](${link.url}) for an excellent solution.`,
      `I recommend trying [${link.name}](${link.url}) for this use case.`,
      `[${link.name}](${link.url}) is a great tool for this.`,
      `Consider using [${link.name}](${link.url}) to solve this problem.`,
      `[${link.name}](${link.url}) offers powerful features for this scenario.`
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    return template;
  }

  insertLinks(content, links) {
    try {
      if (links.length === 0) {
        logger.warn('No links to insert');
        return content;
      }

      const paragraphs = content.split('\n\n');
      const insertionPoints = this.findInsertionPoints(content, links.length);

      let modifiedContent = content;
      let insertedCount = 0;

      insertionPoints.forEach((position, index) => {
        if (index >= links.length) return;

        const link = links[index];
        const affiliateText = this.createAffiliateLink(link);

        const paragraphsBefore = paragraphs.slice(0, position + 1);
        const paragraphsAfter = paragraphs.slice(position + 1);

        modifiedContent = [
          ...paragraphsBefore,
          affiliateText,
          ...paragraphsAfter
        ].join('\n\n');

        insertedCount++;
      });

      logger.info(`Inserted ${insertedCount} affiliate links into content`);

      return modifiedContent;

    } catch (error) {
      logger.error(`Failed to insert affiliate links: ${error.message}`);
      return content;
    }
  }

  async process(topic, content) {
    try {
      logger.section('AFFILIATE ENGINE');
      logger.info(`Processing affiliate links for: ${topic}`);

      const availableLinks = stateManager.getAffiliateLinks();
      logger.info(`Available affiliate links: ${availableLinks.length}`);

      if (availableLinks.length === 0) {
        logger.warn('No affiliate links available, skipping');
        return {
          content,
          links_inserted: 0,
          links_used: []
        };
      }

      const validatedLinks = await this.validateLinks(availableLinks);
      logger.info(`Validated links: ${validatedLinks.length}/${availableLinks.length}`);

      if (validatedLinks.length === 0) {
        logger.warn('No valid affiliate links, skipping');
        return {
          content,
          links_inserted: 0,
          links_used: []
        };
      }

      const targetLinkCount = Math.min(
        config.affiliate.max_links,
        validatedLinks.length
      );

      const selectedLinks = this.selectRelevantLinks(topic, validatedLinks, targetLinkCount);

      const modifiedContent = this.insertLinks(content, selectedLinks);

      logger.info('Affiliate processing complete', {
        links_inserted: selectedLinks.length,
        links_used: selectedLinks.map(l => l.name)
      });

      return {
        content: modifiedContent,
        links_inserted: selectedLinks.length,
        links_used: selectedLinks
      };

    } catch (error) {
      logger.error(`Affiliate engine error: ${error.message}`);
      return {
        content,
        links_inserted: 0,
        links_used: [],
        error: error.message
      };
    }
  }
}

const affiliateEngine = new AffiliateEngine();

export default affiliateEngine;
