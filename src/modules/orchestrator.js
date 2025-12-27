const TopicDiscovery = require('./topicDiscovery');
const ContentGeneration = require('./contentGeneration');
const AssetEngine = require('./assetEngine');
const PublishingStealth = require('./publishingStealth');
const StateManager = require('../utils/stateManager');
const CloudflareWarp = require('../utils/cloudflareWarp');
const logger = require('../utils/logger');

class Orchestrator {
  constructor() {
    this.stateManager = new StateManager();
    this.topicDiscovery = new TopicDiscovery();
    this.contentGeneration = new ContentGeneration();
    this.assetEngine = new AssetEngine();
    this.publishingStealth = new PublishingStealth();
    this.cloudflareWarp = new CloudflareWarp();
  }

  async run() {
    try {
      logger.info('Starting Blogt Autonomous Revenue Engine...');
      
      // Check if we can publish (24-hour rule)
      if (!this.stateManager.canPublish()) {
        logger.info('24-hour cooldown period not elapsed, skipping run');
        return { success: false, reason: 'cooldown' };
      }
      
      // Check if we should abort (3 consecutive low scores)
      if (this.stateManager.shouldAbort()) {
        logger.error('Auto-abort triggered: 3 consecutive low FES2 scores');
        return { success: false, reason: 'auto_abort' };
      }
      
      // Initialize Cloudflare WARP
      await this.initializeNetwork();
      
      // Discover topics
      const topics = await this.discoverTopics();
      
      // Get best topic to publish
      const bestTopic = this.getBestTopic(topics);
      if (!bestTopic) {
        logger.warn('No suitable topics found for publishing');
        await this.stateManager.incrementLowScores();
        return { success: false, reason: 'no_suitable_topics' };
      }
      
      // Generate content
      const article = await this.generateContent(bestTopic);
      
      // Get assets
      const image = await this.getArticleImage(bestTopic);
      
      // Publish to Medium
      const publishResult = await this.publishArticle(article);
      
      if (publishResult.success) {
        // Update state
        await this.stateManager.updateLastPublish(bestTopic.hash);
        logger.info('Publish cycle completed successfully');
        return { success: true, url: publishResult.url };
      } else {
        logger.error('Publish cycle failed');
        await this.stateManager.addErrorTrace(new Error(publishResult.error));
        return { success: false, reason: 'publish_failed' };
      }
    } catch (error) {
      logger.error('Orchestrator error:', error.message);
      await this.stateManager.addErrorTrace(error);
      return { success: false, reason: 'orchestrator_error' };
    } finally {
      await this.cleanup();
    }
  }

  async initializeNetwork() {
    try {
      // Connect to Cloudflare WARP
      await this.cloudflareWarp.connect();
      
      // Validate IP (not Microsoft/Azure)
      const ipValid = await this.cloudflareWarp.validateIP();
      
      if (!ipValid) {
        throw new Error('IP validation failed - Microsoft/Azure range detected');
      }
      
      logger.info('Network initialized successfully');
    } catch (error) {
      logger.error('Network initialization failed:', error.message);
      throw error;
    }
  }

  async discoverTopics() {
    try {
      logger.info('Starting topic discovery...');
      const topics = await this.topicDiscovery.discoverTopics();
      
      if (topics.publish.length === 0) {
        logger.warn('No topics met publish threshold (> 90)');
        await this.stateManager.incrementLowScores();
      } else {
        logger.info(`Found ${topics.publish.length} topics ready for publishing`);
      }
      
      return topics;
    } catch (error) {
      logger.error('Topic discovery failed:', error.message);
      throw error;
    }
  }

  getBestTopic(topics) {
    if (!topics || topics.publish.length === 0) {
      return null;
    }
    
    // Get highest scoring topic
    const bestTopic = topics.publish.reduce((prev, current) => 
      (prev.score > current.score) ? prev : current
    );
    
    // Check if topic was already processed
    if (this.stateManager.isTopicProcessed(bestTopic.hash)) {
      logger.warn('Best topic already processed, skipping');
      return null;
    }
    
    logger.info(`Selected best topic: "${bestTopic.topic}" (score: ${bestTopic.score})`);
    
    return bestTopic;
  }

  async generateContent(topic) {
    try {
      logger.info(`Generating content for topic: "${topic.topic}"`);
      
      const article = await this.contentGeneration.generateArticle(topic.topic);
      
      logger.info(`Content generated: ${article.wordCount} words, readability: ${article.readabilityScore}`);
      
      return article;
    } catch (error) {
      logger.error('Content generation failed:', error.message);
      throw error;
    }
  }

  async getArticleImage(topic) {
    try {
      logger.info('Sourcing image for article...');
      
      const image = await this.assetEngine.getImageForArticle(topic.topic);
      
      if (image) {
        logger.info(`Image sourced: ${image.localPath}`);
        return image;
      } else {
        logger.warn('No suitable image found, proceeding without image');
        return null;
      }
    } catch (error) {
      logger.error('Image sourcing failed:', error.message);
      return null;
    }
  }

  async publishArticle(article) {
    try {
      logger.info('Starting stealth publishing process...');
      
      // Initialize publishing
      await this.publishingStealth.initialize();
      
      // Get Medium cookies from environment
      const mediumCookies = process.env.MEDIUM_COOKIES_JSON;
      if (!mediumCookies) {
        throw new Error('MEDIUM_COOKIES_JSON environment variable not set');
      }
      
      // Publish the article
      const result = await this.publishingStealth.publishToMedium(article, mediumCookies);
      
      return result;
    } catch (error) {
      logger.error('Publishing failed:', error.message);
      throw error;
    }
  }

  async cleanup() {
    try {
      // Close publishing resources
      await this.publishingStealth.close();
      
      // Disconnect Cloudflare WARP
      await this.cloudflareWarp.disconnect();
      
      logger.info('Cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error.message);
    }
  }
}

module.exports = Orchestrator;