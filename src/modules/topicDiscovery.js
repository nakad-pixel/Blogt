import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fetch from 'node-fetch';
import config from '../../config/default.js';
import logger from '../utils/logger.js';
import security from '../utils/security.js';
import stateManager from '../utils/stateManager.js';
import errorHandler, { BlogtError, ERROR_CATEGORIES } from '../utils/errorHandler.js';

puppeteer.use(StealthPlugin());

class TopicDiscovery {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (this.browser) {
      return;
    }

    logger.info('Initializing Puppeteer browser for topic discovery...');
    
    const viewport = security.getRandomViewport();
    const userAgent = security.getRandomUserAgent();

    this.browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args
    });

    const page = await this.browser.newPage();
    await page.setViewport(viewport);
    await page.setUserAgent(userAgent);
    
    logger.info('Browser initialized successfully');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  async scrapeReddit(subreddit) {
    try {
      logger.info(`Scraping Reddit: r/${subreddit}`);
      
      const page = await this.browser.newPage();
      await page.setViewport(security.getRandomViewport());
      
      const url = `${config.sources.reddit.base_url}${subreddit}/hot/`;
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: config.timeouts.puppeteer_navigation 
      });

      await page.waitForTimeout(2000);

      const posts = await page.evaluate(() => {
        const results = [];
        const postElements = document.querySelectorAll('[data-testid="post-container"]');
        
        postElements.forEach((post, index) => {
          if (index >= 20) return;
          
          const titleEl = post.querySelector('h3');
          const votesEl = post.querySelector('[data-click-id="upvote"]');
          const commentsEl = post.querySelector('a[data-click-id="comments"]');
          
          if (titleEl) {
            const title = titleEl.textContent.trim();
            const votes = votesEl ? parseInt(votesEl.textContent) || 0 : 0;
            const comments = commentsEl ? parseInt(commentsEl.textContent) || 0 : 0;
            
            results.push({
              title,
              votes,
              comments,
              engagement: votes + (comments * 5)
            });
          }
        });
        
        return results;
      });

      await page.close();
      
      logger.info(`Scraped ${posts.length} posts from r/${subreddit}`);
      return posts;

    } catch (error) {
      logger.error(`Failed to scrape Reddit r/${subreddit}: ${error.message}`);
      return [];
    }
  }

  async scrapeHackerNews() {
    try {
      logger.info('Scraping Hacker News...');
      
      const page = await this.browser.newPage();
      await page.setViewport(security.getRandomViewport());
      
      await page.goto(config.sources.hackernews.url, { 
        waitUntil: 'networkidle2',
        timeout: config.timeouts.puppeteer_navigation 
      });

      const posts = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('tr.athing');
        
        rows.forEach((row, index) => {
          if (index >= 30) return;
          
          const titleEl = row.querySelector('.titleline > a');
          const scoreRow = row.nextElementSibling;
          const scoreEl = scoreRow ? scoreRow.querySelector('.score') : null;
          
          if (titleEl) {
            const title = titleEl.textContent.trim();
            const score = scoreEl ? parseInt(scoreEl.textContent) || 0 : 0;
            
            results.push({
              title,
              score,
              engagement: score
            });
          }
        });
        
        return results;
      });

      await page.close();
      
      logger.info(`Scraped ${posts.length} posts from Hacker News`);
      return posts;

    } catch (error) {
      logger.error(`Failed to scrape Hacker News: ${error.message}`);
      return [];
    }
  }

  async scrapeGoogleTrends() {
    try {
      logger.info('Scraping Google Trends...');
      
      const page = await this.browser.newPage();
      await page.setViewport(security.getRandomViewport());
      
      await page.goto(`${config.sources.google_trends.url}?geo=${config.sources.google_trends.region}`, { 
        waitUntil: 'networkidle2',
        timeout: config.timeouts.puppeteer_navigation 
      });

      await page.waitForTimeout(3000);

      const trends = await page.evaluate(() => {
        const results = [];
        const trendElements = document.querySelectorAll('.feed-item');
        
        trendElements.forEach((item, index) => {
          if (index >= 20) return;
          
          const titleEl = item.querySelector('.title');
          const trafficEl = item.querySelector('.search-count-title');
          
          if (titleEl) {
            const title = titleEl.textContent.trim();
            const traffic = trafficEl ? trafficEl.textContent.trim() : 'Unknown';
            
            results.push({
              title,
              traffic,
              engagement: 100
            });
          }
        });
        
        return results;
      });

      await page.close();
      
      logger.info(`Scraped ${trends.length} trends from Google Trends`);
      return trends;

    } catch (error) {
      logger.error(`Failed to scrape Google Trends: ${error.message}`);
      return [];
    }
  }

  extractTopics(posts) {
    const topics = new Set();
    const aiKeywords = [
      'AI', 'artificial intelligence', 'machine learning', 'ML', 'deep learning',
      'neural network', 'GPT', 'LLM', 'chatbot', 'generative', 'diffusion',
      'transformer', 'OpenAI', 'Claude', 'Gemini', 'Llama', 'Mistral',
      'stable diffusion', 'midjourney', 'DALL-E', 'automation', 'AGI'
    ];

    posts.forEach(post => {
      const title = post.title.toLowerCase();
      
      const hasAIKeyword = aiKeywords.some(keyword => 
        title.includes(keyword.toLowerCase())
      );

      if (hasAIKeyword && post.engagement > 50) {
        let topic = post.title.replace(/\[.*?\]/g, '').trim();
        topic = topic.replace(/^\W+|\W+$/g, '');
        
        if (topic.length > 20 && topic.length < 150) {
          topics.add(topic);
        }
      }
    });

    return Array.from(topics);
  }

  async checkCompetition(topic) {
    try {
      const searchQuery = encodeURIComponent(`${topic} site:medium.com`);
      const response = await fetch(`https://www.google.com/search?q=${searchQuery}`, {
        headers: {
          'User-Agent': security.getRandomUserAgent()
        },
        timeout: 10000
      });

      const html = await response.text();
      
      const resultStats = html.match(/About ([\d,]+) results/);
      const resultCount = resultStats ? parseInt(resultStats[1].replace(/,/g, '')) : 0;

      return {
        count: resultCount,
        saturated: resultCount > 1000
      };

    } catch (error) {
      logger.warn(`Failed to check competition for "${topic}": ${error.message}`);
      return { count: 0, saturated: false };
    }
  }

  calculateDemandScore(engagement) {
    return Math.min(100, (engagement / 10));
  }

  calculateCompetitionScore(competitionCount) {
    if (competitionCount > 1000) return 20;
    if (competitionCount > 500) return 50;
    if (competitionCount > 100) return 70;
    return 90;
  }

  async evaluateTopics(topics) {
    logger.info(`Evaluating ${topics.length} topics...`);
    
    const evaluated = [];

    for (const topic of topics.slice(0, 15)) {
      if (stateManager.hasPublishedTopic(topic)) {
        logger.info(`Skipping already published topic: ${topic}`);
        continue;
      }

      if (stateManager.hasTopicInQueue(topic)) {
        logger.info(`Skipping topic already in queue: ${topic}`);
        continue;
      }

      logger.info(`Evaluating: ${topic}`);

      const competition = await this.checkCompetition(topic);
      
      if (competition.saturated) {
        logger.info(`Topic too saturated (${competition.count} results): ${topic}`);
        continue;
      }

      const demandScore = this.calculateDemandScore(Math.random() * 500 + 100);
      const competitionScore = this.calculateCompetitionScore(competition.count);
      
      evaluated.push({
        topic,
        demand_score: demandScore,
        competition_score: competitionScore,
        overall_score: (demandScore * 0.6 + competitionScore * 0.4)
      });

      await errorHandler.sleep(security.getRandomDelay(500, 1500));
    }

    evaluated.sort((a, b) => b.overall_score - a.overall_score);
    
    logger.info(`Evaluation complete. Top topics:`, evaluated.slice(0, 5));
    
    return evaluated;
  }

  async discover() {
    try {
      logger.section('TOPIC DISCOVERY');
      
      await this.initialize();

      const allPosts = [];

      for (const subreddit of config.sources.reddit.subreddits) {
        const posts = await this.scrapeReddit(subreddit);
        allPosts.push(...posts);
        await errorHandler.sleep(2000);
      }

      const hnPosts = await this.scrapeHackerNews();
      allPosts.push(...hnPosts);

      const trends = await this.scrapeGoogleTrends();
      allPosts.push(...trends);

      logger.info(`Collected ${allPosts.length} total posts/trends`);

      const topics = this.extractTopics(allPosts);
      logger.info(`Extracted ${topics.length} AI-related topics`);

      const evaluatedTopics = await this.evaluateTopics(topics);

      await this.cleanup();

      return evaluatedTopics;

    } catch (error) {
      await this.cleanup();
      throw errorHandler.handle(error, 'Topic Discovery');
    }
  }
}

export default TopicDiscovery;
