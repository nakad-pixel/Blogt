import config from '../../config/default.js';
import logger from '../utils/logger.js';
import { BlogtError, ERROR_CATEGORIES } from '../utils/errorHandler.js';

class ScoringEngine {
  constructor() {
    this.weights = {
      topic: 0.35,
      affiliate: 0.25,
      engagement: 0.20,
      trendVelocity: 0.10,
      pes: 0.10
    };
  }

  calculatePES(demandScore, competitionScore) {
    if (demandScore === undefined || competitionScore === undefined) {
      logger.error('PES calculation failed: missing demand or competition score');
      return null;
    }

    const pes = (demandScore * 0.6) + (competitionScore * 0.4);
    logger.info(`PES calculated: ${pes.toFixed(2)} (demand: ${demandScore}, competition: ${competitionScore})`);
    
    return Math.round(pes * 100) / 100;
  }

  calculateAffiliateScore(topic, availableLinks) {
    const topicLower = topic.toLowerCase();
    
    const relevantKeywords = {
      llm: ['gpt', 'claude', 'llm', 'language model', 'chatbot', 'chat', 'conversational'],
      image_generation: ['image', 'art', 'generate', 'midjourney', 'dall-e', 'stable diffusion', 'visual'],
      automation: ['automation', 'workflow', 'task', 'productivity'],
      analytics: ['analytics', 'data', 'insights', 'metrics']
    };

    let matchCount = 0;
    let totalRelevance = 0;

    availableLinks.forEach(link => {
      const keywords = relevantKeywords[link.category] || [];
      const hasMatch = keywords.some(keyword => topicLower.includes(keyword));
      
      if (hasMatch) {
        matchCount++;
        totalRelevance += 25;
      }
    });

    const affiliateScore = Math.min(100, totalRelevance + (matchCount > 0 ? 20 : 0));
    
    logger.info(`Affiliate score: ${affiliateScore} (${matchCount} relevant links found)`);
    return affiliateScore;
  }

  calculateEngagementScore(topic) {
    const engagementFactors = {
      hasQuestion: topic.includes('?') ? 15 : 0,
      hasNumber: /\d+/.test(topic) ? 10 : 0,
      hasActionVerb: /^(how|why|what|best|top|guide)/i.test(topic) ? 20 : 0,
      length: topic.length > 40 && topic.length < 100 ? 15 : 5,
      hasPowerWord: /(best|ultimate|complete|essential|revolutionary|breakthrough)/i.test(topic) ? 10 : 0
    };

    const baseScore = 40;
    const bonusScore = Object.values(engagementFactors).reduce((a, b) => a + b, 0);
    const engagementScore = Math.min(100, baseScore + bonusScore);

    logger.info(`Engagement score: ${engagementScore}`, engagementFactors);
    return engagementScore;
  }

  calculateTrendVelocity(demandScore) {
    const normalized = Math.min(100, demandScore * 1.2);
    logger.info(`Trend velocity: ${normalized.toFixed(2)}`);
    return normalized;
  }

  calculateFES(topicScore, affiliateScore, engagementScore, trendVelocity, pes) {
    if ([topicScore, affiliateScore, engagementScore, trendVelocity, pes].some(s => s === undefined || s === null)) {
      logger.error('FES calculation failed: missing required scores');
      return null;
    }

    const fes = (topicScore * 0.4) + 
                (affiliateScore * 0.3) + 
                (engagementScore * 0.2) + 
                (trendVelocity * 0.1);

    logger.info(`FES calculated: ${fes.toFixed(2)}`);
    return Math.round(fes * 100) / 100;
  }

  calculateFES2(topicScore, affiliateScore, engagementScore, trendVelocity, pes) {
    if ([topicScore, affiliateScore, engagementScore, trendVelocity, pes].some(s => s === undefined || s === null)) {
      logger.error('FES2 calculation failed: missing required scores');
      return null;
    }

    const fes2 = (topicScore * this.weights.topic) + 
                 (affiliateScore * this.weights.affiliate) + 
                 (engagementScore * this.weights.engagement) + 
                 (trendVelocity * this.weights.trendVelocity) + 
                 (pes * this.weights.pes);

    logger.info(`FES2 calculated: ${fes2.toFixed(2)}`, {
      topicScore: (topicScore * this.weights.topic).toFixed(2),
      affiliateScore: (affiliateScore * this.weights.affiliate).toFixed(2),
      engagementScore: (engagementScore * this.weights.engagement).toFixed(2),
      trendVelocity: (trendVelocity * this.weights.trendVelocity).toFixed(2),
      pes: (pes * this.weights.pes).toFixed(2)
    });

    return Math.round(fes2 * 100) / 100;
  }

  scoreTopicForQueue(topic, demandScore, competitionScore, affiliateLinks) {
    try {
      logger.info(`Scoring topic for queue: ${topic}`);

      const pes = this.calculatePES(demandScore, competitionScore);
      if (pes === null) {
        throw new BlogtError(
          'Failed to calculate PES',
          ERROR_CATEGORIES.CONTENT_VALIDATION_FAILURE,
          null,
          true
        );
      }

      const topicScore = (demandScore + competitionScore) / 2;
      const affiliateScore = this.calculateAffiliateScore(topic, affiliateLinks);
      const engagementScore = this.calculateEngagementScore(topic);
      const trendVelocity = this.calculateTrendVelocity(demandScore);

      const fes = this.calculateFES(topicScore, affiliateScore, engagementScore, trendVelocity, pes);
      const fes2 = this.calculateFES2(topicScore, affiliateScore, engagementScore, trendVelocity, pes);

      if (fes2 === null) {
        throw new BlogtError(
          'Failed to calculate FES2',
          ERROR_CATEGORIES.CONTENT_VALIDATION_FAILURE,
          null,
          true
        );
      }

      const scores = {
        pes,
        fes,
        fes2,
        topicScore,
        affiliateScore,
        engagementScore,
        trendVelocity
      };

      logger.info(`Topic scoring complete:`, scores);

      return scores;

    } catch (error) {
      logger.error(`Error scoring topic: ${error.message}`);
      return null;
    }
  }

  meetsQueueThreshold(fes2) {
    const meets = fes2 >= config.queue_threshold;
    logger.info(`Queue threshold check (${config.queue_threshold}): ${meets ? 'PASS' : 'FAIL'} (FES2: ${fes2})`);
    return meets;
  }

  meetsPublishThreshold(fes2) {
    const meets = fes2 >= config.publish_threshold;
    logger.info(`Publish threshold check (${config.publish_threshold}): ${meets ? 'PASS' : 'FAIL'} (FES2: ${fes2})`);
    return meets;
  }
}

const scoringEngine = new ScoringEngine();

export default scoringEngine;
