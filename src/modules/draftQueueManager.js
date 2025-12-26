import config from '../../config/default.js';
import logger from '../utils/logger.js';
import stateManager from '../utils/stateManager.js';
import TopicDiscovery from './topicDiscovery.js';
import contentGenerator from './contentGenerator.js';
import scoringEngine from './scoringEngine.js';
import affiliateEngine from './affiliateEngine.js';
import errorHandler from '../utils/errorHandler.js';

class DraftQueueManager {
  constructor() {
    this.processing = false;
  }

  checkQueueStatus() {
    const queueSize = stateManager.getQueueSize();
    
    logger.info(`Current queue status: ${queueSize}/${config.queue_max} drafts`);

    const needsRefill = queueSize < config.queue_min;
    const hasSpace = queueSize < config.queue_max;

    return {
      size: queueSize,
      needsRefill,
      hasSpace,
      min: config.queue_min,
      max: config.queue_max
    };
  }

  async discoverTopics() {
    try {
      logger.info('Starting topic discovery...');
      
      const discovery = new TopicDiscovery();
      const topics = await discovery.discover();

      logger.info(`Discovered ${topics.length} potential topics`);
      
      return topics;

    } catch (error) {
      logger.error(`Topic discovery failed: ${error.message}`);
      return [];
    }
  }

  async generateDraft(topic, demandScore, competitionScore) {
    try {
      logger.info(`Generating draft for: ${topic}`);

      const affiliateLinks = stateManager.getAffiliateLinks();
      
      const scores = scoringEngine.scoreTopicForQueue(
        topic,
        demandScore,
        competitionScore,
        affiliateLinks
      );

      if (!scores) {
        logger.error('Failed to score topic');
        return null;
      }

      if (!scoringEngine.meetsQueueThreshold(scores.fes2)) {
        logger.info(`Topic does not meet queue threshold: ${topic} (FES2: ${scores.fes2})`);
        return null;
      }

      const generatedContent = await contentGenerator.generate(topic);

      const affiliateResult = await affiliateEngine.process(topic, generatedContent.content);

      const draft = {
        topic,
        title: generatedContent.title,
        fes2_score: scores.fes2,
        content: affiliateResult.content,
        affiliate_links: affiliateResult.links_used,
        word_count: generatedContent.word_count,
        readability_score: generatedContent.readability_score,
        humanization_score: generatedContent.humanization_score,
        scores: {
          pes: scores.pes,
          fes: scores.fes,
          fes2: scores.fes2,
          topic: scores.topicScore,
          affiliate: scores.affiliateScore,
          engagement: scores.engagementScore,
          trend_velocity: scores.trendVelocity
        }
      };

      logger.info('Draft generated successfully', {
        topic: draft.topic,
        fes2: draft.fes2_score,
        word_count: draft.word_count
      });

      return draft;

    } catch (error) {
      logger.error(`Failed to generate draft for "${topic}": ${error.message}`);
      return null;
    }
  }

  async refillQueue(targetSize = null) {
    try {
      if (this.processing) {
        logger.warn('Queue refill already in progress, skipping');
        return false;
      }

      this.processing = true;

      logger.section('DRAFT QUEUE REFILL');

      const status = this.checkQueueStatus();
      
      if (!targetSize) {
        targetSize = config.queue_min;
      }

      const needed = Math.max(0, targetSize - status.size);

      if (needed === 0) {
        logger.info('Queue does not need refilling');
        this.processing = false;
        return true;
      }

      logger.info(`Need to generate ${needed} drafts to reach target of ${targetSize}`);

      const topics = await this.discoverTopics();

      if (topics.length === 0) {
        logger.error('No topics discovered, cannot refill queue');
        this.processing = false;
        return false;
      }

      let added = 0;
      let attempted = 0;

      for (const topicData of topics) {
        if (added >= needed) {
          break;
        }

        if (attempted >= needed * 3) {
          logger.warn('Too many attempts, stopping queue refill');
          break;
        }

        attempted++;

        if (stateManager.hasPublishedTopic(topicData.topic)) {
          logger.info(`Skipping published topic: ${topicData.topic}`);
          continue;
        }

        if (stateManager.hasTopicInQueue(topicData.topic)) {
          logger.info(`Skipping topic already in queue: ${topicData.topic}`);
          continue;
        }

        try {
          const draft = await this.generateDraft(
            topicData.topic,
            topicData.demand_score,
            topicData.competition_score
          );

          if (draft) {
            const success = stateManager.addDraftToQueue(draft);
            
            if (success) {
              added++;
              logger.info(`Added draft to queue (${added}/${needed}): ${draft.topic}`);
              
              stateManager.save();
              
              await errorHandler.sleep(2000);
            }
          }

        } catch (error) {
          logger.error(`Error processing topic "${topicData.topic}": ${error.message}`);
          continue;
        }
      }

      logger.info(`Queue refill complete: added ${added} drafts`);

      this.processing = false;
      return added > 0;

    } catch (error) {
      this.processing = false;
      throw errorHandler.handle(error, 'Draft Queue Manager');
    }
  }

  async ensureMinimumQueue() {
    const status = this.checkQueueStatus();
    
    if (status.needsRefill) {
      logger.info('Queue below minimum, triggering refill');
      return await this.refillQueue();
    }

    logger.info('Queue has sufficient drafts');
    return true;
  }

  getNextDraftForPublishing() {
    const draft = stateManager.getTopDraft();

    if (!draft) {
      logger.warn('No drafts available in queue');
      return null;
    }

    const meetsThreshold = scoringEngine.meetsPublishThreshold(draft.fes2_score);

    if (!meetsThreshold) {
      logger.warn(`Top draft does not meet publish threshold: ${draft.topic} (FES2: ${draft.fes2_score})`);
      return null;
    }

    logger.info(`Selected draft for publishing: ${draft.topic} (FES2: ${draft.fes2_score})`);
    
    return draft;
  }
}

const draftQueueManager = new DraftQueueManager();

export default draftQueueManager;
