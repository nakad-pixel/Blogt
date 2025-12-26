const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const logger = require('../utils/logger');
const OpenRouterClient = require('../utils/openrouter');

class TopicDiscovery {
  constructor() {
    this.openrouter = new OpenRouterClient();
    this.discoveredTopics = [];
  }

  async discoverTopics() {
    try {
      // Get topics from multiple sources
      const googleTrendsTopics = await this.scrapeGoogleTrends();
      const redditTopics = await this.scrapeReddit();
      const hackerNewsTopics = await this.scrapeHackerNews();
      
      // Combine and deduplicate
      const allTopics = [...googleTrendsTopics, ...redditTopics, ...hackerNewsTopics];
      const uniqueTopics = [...new Set(allTopics)];
      
      logger.info(`Discovered ${uniqueTopics.length} unique topics from multiple sources`);
      
      // Score topics using FES2
      const scoredTopics = [];
      for (const topic of uniqueTopics) {
        const score = await this.openrouter.scoreTopic(topic);
        const topicHash = this.generateTopicHash(topic);
        
        scoredTopics.push({
          topic,
          score,
          hash: topicHash,
          source: 'multi'
        });
      }
      
      // Filter by queue threshold (> 88)
      const queueTopics = scoredTopics.filter(t => t.score > 88);
      
      // Filter by publish threshold (> 90)
      const publishTopics = scoredTopics.filter(t => t.score > 90);
      
      this.discoveredTopics = {
        all: scoredTopics,
        queue: queueTopics,
        publish: publishTopics
      };
      
      logger.info(`Queue topics (score > 88): ${queueTopics.length}`);
      logger.info(`Publish topics (score > 90): ${publishTopics.length}`);
      
      return this.discoveredTopics;
    } catch (error) {
      logger.error('Error in topic discovery:', error.message);
      throw error;
    }
  }

  async scrapeGoogleTrends() {
    try {
      const response = await axios.get('https://trends.google.com/trends/trendingsearches/daily?geo=US');
      const $ = cheerio.load(response.data);
      
      const topics = [];
      $('div.details-top').each((i, el) => {
        const title = $(el).find('a.title').text().trim();
        if (title) topics.push(title);
      });
      
      return topics.slice(0, 10); // Top 10 trends
    } catch (error) {
      logger.error('Google Trends scraping failed:', error.message);
      return [];
    }
  }

  async scrapeReddit() {
    try {
      const response = await axios.get('https://www.reddit.com/r/all/top/.json?limit=20', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      
      const topics = response.data.data.children.map(post => post.data.title);
      return topics.filter(t => t.length > 10 && t.length < 100); // Filter reasonable lengths
    } catch (error) {
      logger.error('Reddit scraping failed:', error.message);
      return [];
    }
  }

  async scrapeHackerNews() {
    try {
      const response = await axios.get('https://news.ycombinator.com/');
      const $ = cheerio.load(response.data);
      
      const topics = [];
      $('.titleline > a').each((i, el) => {
        const title = $(el).text().trim();
        if (title) topics.push(title);
      });
      
      return topics.slice(0, 15); // Top 15 stories
    } catch (error) {
      logger.error('Hacker News scraping failed:', error.message);
      return [];
    }
  }

  generateTopicHash(topic) {
    return crypto.createHash('sha256').update(topic).digest('hex');
  }

  getTopPublishTopic() {
    if (!this.discoveredTopics || this.discoveredTopics.publish.length === 0) {
      return null;
    }
    
    // Return highest scoring topic
    return this.discoveredTopics.publish.reduce((prev, current) => 
      (prev.score > current.score) ? prev : current
    );
  }

  getQueueTopics() {
    return this.discoveredTopics?.queue || [];
  }
}

module.exports = TopicDiscovery;