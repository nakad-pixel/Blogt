import fetch from 'node-fetch';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from '../../config/default.js';
import logger from '../utils/logger.js';
import security from '../utils/security.js';
import stateManager from '../utils/stateManager.js';
import errorHandler, { BlogtError, ERROR_CATEGORIES } from '../utils/errorHandler.js';

puppeteer.use(StealthPlugin());

class Publisher {
  constructor() {
    this.mediumToken = null;
    this.mediumUsername = null;
    this.mediumPassword = null;
  }

  initialize() {
    this.mediumToken = security.getSecret('MEDIUM_INTEGRATION_TOKEN');
    this.mediumUsername = process.env.MEDIUM_USERNAME;
    this.mediumPassword = process.env.MEDIUM_PASSWORD;
    
    logger.info('Publisher initialized');
  }

  async getMediumUserId() {
    try {
      const response = await fetch(`${config.medium.api_url}/me`, {
        headers: {
          'Authorization': `Bearer ${this.mediumToken}`,
          'Content-Type': 'application/json'
        },
        timeout: config.timeouts.api_request
      });

      if (!response.ok) {
        throw new Error(`Failed to get user ID: ${response.status}`);
      }

      const data = await response.json();
      return data.data.id;

    } catch (error) {
      throw new BlogtError(
        `Failed to get Medium user ID: ${error.message}`,
        ERROR_CATEGORIES.API_FAILURE,
        error,
        true
      );
    }
  }

  async publishViaMediumAPI(draft) {
    try {
      logger.section('PUBLISHING VIA MEDIUM API');
      logger.info(`Publishing: ${draft.title}`);

      if (!this.mediumToken) {
        this.initialize();
      }

      const userId = await this.getMediumUserId();
      logger.info(`Medium User ID: ${userId}`);

      const tags = config.medium.default_tags.slice(0, 5);

      const payload = {
        title: draft.title,
        contentFormat: 'markdown',
        content: draft.content,
        tags: tags,
        publishStatus: config.medium.publish_status
      };

      logger.info('Sending publish request to Medium API...', {
        title: draft.title,
        tags: tags,
        content_length: draft.content.length
      });

      const response = await fetch(`${config.medium.api_url}/users/${userId}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.mediumToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        timeout: config.timeouts.api_request
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new BlogtError(
          `Medium API error: ${response.status} - ${errorText}`,
          ERROR_CATEGORIES.API_FAILURE,
          null,
          true
        );
      }

      const data = await response.json();

      if (!data.data || !data.data.url) {
        throw new BlogtError(
          'Medium API response missing URL',
          ERROR_CATEGORIES.API_FAILURE,
          null,
          true
        );
      }

      const publishedUrl = data.data.url;

      logger.info('Successfully published via Medium API!', {
        url: publishedUrl,
        id: data.data.id
      });

      return {
        success: true,
        published_url: publishedUrl,
        method: 'api',
        post_id: data.data.id
      };

    } catch (error) {
      if (error instanceof BlogtError) {
        throw error;
      }
      throw new BlogtError(
        `Medium API publishing failed: ${error.message}`,
        ERROR_CATEGORIES.API_FAILURE,
        error,
        true
      );
    }
  }

  async publishViaPuppeteer(draft) {
    let browser = null;
    
    try {
      logger.section('PUBLISHING VIA PUPPETEER');
      logger.info('Launching browser with stealth plugin...');

      if (!this.mediumUsername || !this.mediumPassword) {
        throw new BlogtError(
          'Medium credentials not available for Puppeteer fallback',
          ERROR_CATEGORIES.CONFIGURATION_ERROR,
          null,
          false
        );
      }

      const viewport = security.getRandomViewport();
      const userAgent = security.getRandomUserAgent();

      browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        args: config.puppeteer.args
      });

      const page = await browser.newPage();
      await page.setViewport(viewport);
      await page.setUserAgent(userAgent);

      stateManager.addPuppeteerLog({ action: 'browser_launched' });

      logger.info('Navigating to Medium login page...');
      await page.goto(config.medium.login_url, {
        waitUntil: 'networkidle2',
        timeout: config.timeouts.puppeteer_navigation
      });

      await page.waitForTimeout(security.getRandomDelay(1000, 2000));
      stateManager.addPuppeteerLog({ action: 'navigated_to_login' });

      logger.info('Logging in to Medium...');
      
      await page.waitForSelector('input[type="email"], input[name="email"]', {
        timeout: config.timeouts.puppeteer_action
      });

      await page.type('input[type="email"], input[name="email"]', this.mediumUsername, {
        delay: security.getRandomDelay(50, 100)
      });

      await page.waitForTimeout(security.getRandomDelay(500, 1000));

      const nextButton = await page.$('button[type="submit"]');
      if (nextButton) {
        await nextButton.click();
        await page.waitForTimeout(security.getRandomDelay(1000, 2000));
      }

      const passwordSelector = 'input[type="password"], input[name="password"]';
      await page.waitForSelector(passwordSelector, {
        timeout: config.timeouts.puppeteer_action
      });

      await page.type(passwordSelector, this.mediumPassword, {
        delay: security.getRandomDelay(50, 100)
      });

      await page.waitForTimeout(security.getRandomDelay(500, 1000));

      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        await loginButton.click();
        await page.waitForNavigation({
          waitUntil: 'networkidle2',
          timeout: config.timeouts.puppeteer_navigation
        });
      }

      stateManager.addPuppeteerLog({ action: 'logged_in' });
      logger.info('Successfully logged in');

      await page.waitForTimeout(security.getRandomDelay(2000, 3000));

      logger.info('Navigating to new story page...');
      await page.goto(config.medium.editor_url, {
        waitUntil: 'networkidle2',
        timeout: config.timeouts.puppeteer_navigation
      });

      await page.waitForTimeout(security.getRandomDelay(2000, 3000));
      stateManager.addPuppeteerLog({ action: 'navigated_to_editor' });

      logger.info('Filling in title...');
      const titleSelector = 'h3[data-default-value], textarea[placeholder*="Title"], div[data-contents="true"]';
      await page.waitForSelector(titleSelector, {
        timeout: config.timeouts.puppeteer_action
      });

      await page.click(titleSelector);
      await page.waitForTimeout(security.getRandomDelay(500, 1000));

      await security.humanizeTyping(draft.title, page);
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(security.getRandomDelay(1000, 1500));
      stateManager.addPuppeteerLog({ action: 'entered_title' });

      logger.info('Filling in content...');
      
      const contentParagraphs = draft.content.split('\n\n').filter(p => p.trim());
      
      for (let i = 0; i < Math.min(contentParagraphs.length, 50); i++) {
        const paragraph = contentParagraphs[i];
        
        await security.humanizeTyping(paragraph, page);
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        
        if (i % 5 === 0 && i > 0) {
          await page.waitForTimeout(security.getRandomDelay(1000, 2000));
          logger.info(`Progress: ${i}/${contentParagraphs.length} paragraphs`);
        } else {
          await page.waitForTimeout(security.getRandomDelay(200, 500));
        }
      }

      stateManager.addPuppeteerLog({ action: 'entered_content' });
      logger.info('Content filled successfully');

      await page.waitForTimeout(security.getRandomDelay(2000, 3000));

      logger.info('Publishing article...');
      const publishButton = await page.$('button[data-action="publish"]');
      
      if (publishButton) {
        await publishButton.click();
        await page.waitForTimeout(security.getRandomDelay(2000, 3000));

        const confirmButton = await page.$('button[data-action="publish-confirm"]');
        if (confirmButton) {
          await confirmButton.click();
          await page.waitForTimeout(security.getRandomDelay(3000, 5000));
        }
      }

      stateManager.addPuppeteerLog({ action: 'clicked_publish' });

      const currentUrl = page.url();
      logger.info(`Published article URL: ${currentUrl}`);

      await browser.close();

      return {
        success: true,
        published_url: currentUrl,
        method: 'puppeteer'
      };

    } catch (error) {
      if (browser) {
        await browser.close();
      }

      stateManager.addPuppeteerLog({
        action: 'error',
        error: error.message
      });

      throw new BlogtError(
        `Puppeteer publishing failed: ${error.message}`,
        ERROR_CATEGORIES.PUPPETEER_FAILURE,
        error,
        false
      );
    }
  }

  async publish(draft) {
    try {
      logger.section('PUBLISHING');

      if (!this.mediumToken && !this.mediumUsername) {
        this.initialize();
      }

      const result = await errorHandler.withFallback(
        async () => await this.publishViaMediumAPI(draft),
        async () => await this.publishViaPuppeteer(draft),
        'Publishing'
      );

      logger.info('Publishing successful!', result);

      return result;

    } catch (error) {
      logger.error('All publishing methods failed');
      throw errorHandler.handle(error, 'Publisher');
    }
  }
}

const publisher = new Publisher();

export default publisher;
