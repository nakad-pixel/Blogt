#!/usr/bin/env node

import logger from './utils/logger.js';
import security from './utils/security.js';
import stateManager from './utils/stateManager.js';
import errorHandler, { BlogtError } from './utils/errorHandler.js';
import draftQueueManager from './modules/draftQueueManager.js';
import publisher from './modules/publisher.js';

class Orchestrator {
  constructor() {
    this.startTime = new Date();
  }

  async initialize() {
    try {
      logger.section('BLOGT AUTONOMOUS BLOG AUTOMATION');
      logger.info('Starting orchestrator...');
      logger.info(`Timestamp: ${this.startTime.toISOString()}`);

      logger.info('Validating environment and secrets...');
      security.validateSecrets();

      logger.info('Loading state...');
      stateManager.load();

      logger.info('Initialization complete');
      return true;

    } catch (error) {
      logger.error('Initialization failed', error);
      throw error;
    }
  }

  checkIfPublishedToday() {
    const wasPublished = stateManager.wasPublishedToday();
    
    if (wasPublished) {
      logger.info('Article already published today, skipping execution');
      logger.info(`Last publish date: ${stateManager.get().last_publish_date}`);
      return true;
    }

    logger.info('No article published today, proceeding with workflow');
    return false;
  }

  async ensureDraftQueue() {
    try {
      logger.section('DRAFT QUEUE CHECK');

      const queueStatus = draftQueueManager.checkQueueStatus();

      if (queueStatus.needsRefill) {
        logger.info('Queue needs refilling, triggering topic discovery and content generation');
        
        const refilled = await draftQueueManager.refillQueue();
        
        if (!refilled) {
          throw new BlogtError(
            'Failed to refill draft queue',
            'QUEUE_REFILL_FAILURE',
            null,
            false
          );
        }

        stateManager.save();
      } else {
        logger.info('Queue has sufficient drafts, skipping refill');
      }

      return true;

    } catch (error) {
      throw errorHandler.handle(error, 'Draft Queue Management');
    }
  }

  async selectDraftForPublishing() {
    try {
      logger.section('DRAFT SELECTION');

      const draft = draftQueueManager.getNextDraftForPublishing();

      if (!draft) {
        throw new BlogtError(
          'No suitable draft available for publishing',
          'NO_DRAFT_AVAILABLE',
          null,
          false
        );
      }

      logger.info('Selected draft for publishing:', {
        topic: draft.topic,
        title: draft.title,
        fes2_score: draft.fes2_score,
        word_count: draft.word_count,
        created_at: draft.created_at
      });

      return draft;

    } catch (error) {
      throw errorHandler.handle(error, 'Draft Selection');
    }
  }

  async publishDraft(draft) {
    try {
      logger.section('PUBLISHING');

      const result = await publisher.publish(draft);

      logger.info('Publishing completed successfully!', {
        url: result.published_url,
        method: result.method
      });

      return result;

    } catch (error) {
      throw errorHandler.handle(error, 'Publishing');
    }
  }

  async postPublishCleanup(draft, publishResult) {
    try {
      logger.section('POST-PUBLISH CLEANUP');

      stateManager.updateLastPublishDate();

      stateManager.addPublishedTopic(draft.topic);

      stateManager.removeDraftFromQueue(draft.topic);

      stateManager.updateMetrics(
        draft.scores?.pes || 0,
        draft.scores?.fes || 0,
        draft.scores?.fes2 || draft.fes2_score
      );

      stateManager.clearLastFailure();

      stateManager.save();

      logger.info('Post-publish cleanup complete');

      return true;

    } catch (error) {
      throw errorHandler.handle(error, 'Post-Publish Cleanup');
    }
  }

  async handleFailure(error) {
    try {
      logger.section('FAILURE HANDLING');
      logger.error('Workflow failed', error);

      stateManager.setLastFailure(error);
      stateManager.save();

      logger.error('Error details saved to state');

    } catch (saveError) {
      logger.error('Failed to save error state', saveError);
    }
  }

  printSummary(success, publishResult = null) {
    logger.section('EXECUTION SUMMARY');

    const endTime = new Date();
    const duration = (endTime - this.startTime) / 1000;

    logger.info(`Status: ${success ? 'SUCCESS' : 'FAILED'}`);
    logger.info(`Duration: ${duration.toFixed(2)} seconds`);
    logger.info(`Start Time: ${this.startTime.toISOString()}`);
    logger.info(`End Time: ${endTime.toISOString()}`);

    if (success && publishResult) {
      logger.info('Published Article:', {
        url: publishResult.published_url,
        method: publishResult.method
      });
    }

    const state = stateManager.get();
    logger.info('Final State:', {
      last_publish_date: state.last_publish_date,
      queue_size: state.draft_queue.length,
      published_count: state.published_topics_hashes.length,
      metrics: state.metrics
    });

    logger.info('Execution complete');
  }

  async run() {
    let success = false;
    let publishResult = null;

    try {
      await this.initialize();

      if (this.checkIfPublishedToday()) {
        this.printSummary(true);
        process.exit(0);
      }

      await this.ensureDraftQueue();

      const draft = await this.selectDraftForPublishing();

      publishResult = await this.publishDraft(draft);

      await this.postPublishCleanup(draft, publishResult);

      success = true;

    } catch (error) {
      await this.handleFailure(error);
      success = false;
    } finally {
      this.printSummary(success, publishResult);
      process.exit(success ? 0 : 1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const orchestrator = new Orchestrator();
  orchestrator.run().catch(error => {
    logger.error('Unhandled error in orchestrator', error);
    process.exit(1);
  });
}

export default Orchestrator;
