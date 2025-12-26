import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import logger from './logger.js';
import { BlogtError, ERROR_CATEGORIES } from './errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StateManager {
  constructor() {
    this.statePath = path.join(__dirname, '../../state.yaml');
    this.state = null;
  }

  load() {
    try {
      logger.info('Loading state from state.yaml...');
      
      if (!fs.existsSync(this.statePath)) {
        logger.warn('state.yaml not found, creating with defaults');
        this.state = this.getDefaultState();
        this.save();
        return this.state;
      }

      const content = fs.readFileSync(this.statePath, 'utf8');
      this.state = YAML.parse(content);
      
      logger.info('State loaded successfully', {
        last_publish_date: this.state.last_publish_date,
        draft_queue_size: this.state.draft_queue?.length || 0,
        published_topics_count: this.state.published_topics_hashes?.length || 0
      });

      return this.state;
    } catch (error) {
      throw new BlogtError(
        `Failed to load state: ${error.message}`,
        ERROR_CATEGORIES.STATE_MANAGEMENT_FAILURE,
        error,
        false
      );
    }
  }

  save() {
    try {
      logger.info('Saving state to state.yaml...');
      
      const content = YAML.stringify(this.state);
      fs.writeFileSync(this.statePath, content, 'utf8');
      
      logger.info('State saved successfully');
    } catch (error) {
      throw new BlogtError(
        `Failed to save state: ${error.message}`,
        ERROR_CATEGORIES.STATE_MANAGEMENT_FAILURE,
        error,
        false
      );
    }
  }

  getDefaultState() {
    return {
      niche: 'ai_tools',
      last_publish_date: null,
      published_topics_hashes: [],
      draft_queue: [],
      draft_queue_max: 14,
      metrics: {
        pes: 0,
        fes: 0,
        fes2: 0
      },
      affiliate_links: [
        {
          url: 'https://www.anthropic.com',
          name: 'Anthropic Claude',
          category: 'llm',
          status: 'active'
        },
        {
          url: 'https://openai.com',
          name: 'OpenAI GPT',
          category: 'llm',
          status: 'active'
        },
        {
          url: 'https://www.midjourney.com',
          name: 'Midjourney',
          category: 'image_generation',
          status: 'active'
        }
      ],
      puppeteer_log: [],
      last_failure: null
    };
  }

  get() {
    if (!this.state) {
      this.load();
    }
    return this.state;
  }

  getTopicHash(topic) {
    return crypto.createHash('sha256').update(topic.toLowerCase().trim()).digest('hex');
  }

  hasPublishedTopic(topic) {
    const hash = this.getTopicHash(topic);
    return this.state.published_topics_hashes.includes(hash);
  }

  addPublishedTopic(topic) {
    const hash = this.getTopicHash(topic);
    if (!this.state.published_topics_hashes.includes(hash)) {
      this.state.published_topics_hashes.push(hash);
      logger.info(`Added topic hash to published list: ${hash}`);
    }
  }

  hasTopicInQueue(topic) {
    const hash = this.getTopicHash(topic);
    return this.state.draft_queue.some(draft => 
      this.getTopicHash(draft.topic) === hash
    );
  }

  addDraftToQueue(draft) {
    if (this.hasTopicInQueue(draft.topic)) {
      logger.warn(`Topic already in queue: ${draft.topic}`);
      return false;
    }

    this.state.draft_queue.push({
      ...draft,
      created_at: new Date().toISOString()
    });

    this.state.draft_queue.sort((a, b) => b.fes2_score - a.fes2_score);

    if (this.state.draft_queue.length > this.state.draft_queue_max) {
      const removed = this.state.draft_queue.pop();
      logger.info(`Queue full, removed lowest scoring draft: ${removed.topic}`);
    }

    logger.info(`Added draft to queue: ${draft.topic} (FES2: ${draft.fes2_score})`);
    return true;
  }

  getTopDraft() {
    if (this.state.draft_queue.length === 0) {
      return null;
    }
    return this.state.draft_queue[0];
  }

  removeDraftFromQueue(topic) {
    const hash = this.getTopicHash(topic);
    const initialLength = this.state.draft_queue.length;
    
    this.state.draft_queue = this.state.draft_queue.filter(draft => 
      this.getTopicHash(draft.topic) !== hash
    );

    if (this.state.draft_queue.length < initialLength) {
      logger.info(`Removed draft from queue: ${topic}`);
      return true;
    }

    return false;
  }

  updateLastPublishDate(date = null) {
    this.state.last_publish_date = date || new Date().toISOString().split('T')[0];
    logger.info(`Updated last_publish_date: ${this.state.last_publish_date}`);
  }

  wasPublishedToday() {
    if (!this.state.last_publish_date) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    return this.state.last_publish_date === today;
  }

  updateMetrics(pes, fes, fes2) {
    this.state.metrics = { pes, fes, fes2 };
    logger.info('Updated metrics', this.state.metrics);
  }

  setLastFailure(error) {
    this.state.last_failure = {
      timestamp: new Date().toISOString(),
      message: error.message,
      category: error.category || 'UNKNOWN'
    };
  }

  clearLastFailure() {
    this.state.last_failure = null;
  }

  addPuppeteerLog(entry) {
    this.state.puppeteer_log.push({
      timestamp: new Date().toISOString(),
      ...entry
    });

    if (this.state.puppeteer_log.length > 100) {
      this.state.puppeteer_log = this.state.puppeteer_log.slice(-50);
    }
  }

  getQueueSize() {
    return this.state.draft_queue.length;
  }

  getAffiliateLinks(category = null) {
    if (!category) {
      return this.state.affiliate_links.filter(link => link.status === 'active');
    }
    return this.state.affiliate_links.filter(link => 
      link.status === 'active' && link.category === category
    );
  }
}

const stateManager = new StateManager();

export default stateManager;
