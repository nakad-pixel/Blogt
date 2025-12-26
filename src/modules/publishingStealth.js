const PuppeteerHelpers = require('../utils/puppeteerHelpers');
const logger = require('../utils/logger');

class PublishingStealth {
  constructor() {
    this.helpers = new PuppeteerHelpers();
    this.maxRetries = 3;
  }

  async initialize() {
    await this.helpers.initialize();
  }

  async close() {
    await this.helpers.close();
  }

  async publishToMedium(article, cookies) {
    try {
      // Load Medium and inject cookies
      await this.setupMediumSession(cookies);
      
      // Navigate to new story page
      await this.navigateToNewStory();
      
      // Fill in article content
      await this.fillArticleContent(article);
      
      // Verify draft saved
      const draftSaved = await this.verifyDraftSaved();
      if (!draftSaved) {
        throw new Error('Draft not saved successfully');
      }
      
      // Publish the article
      const publishSuccess = await this.publishArticle();
      
      if (!publishSuccess) {
        throw new Error('Publish failed');
      }
      
      // Get published URL
      const publishedUrl = await this.getPublishedUrl();
      
      logger.info(`Article published successfully: ${publishedUrl}`);
      
      return {
        success: true,
        url: publishedUrl
      };
    } catch (error) {
      logger.error('Publish failed:', error.message);
      await this.handlePublishError(error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async setupMediumSession(cookies) {
    try {
      // Parse cookies from JSON
      const parsedCookies = JSON.parse(cookies);
      
      // Set cookies before navigating
      await this.helpers.page.setCookie(...parsedCookies);
      
      // Navigate to Medium
      await this.helpers.page.goto('https://medium.com', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      logger.info('Medium session initialized with cookies');
      
      // Human-like behavior: scroll a bit
      await this.helpers.humanScroll();
      
    } catch (error) {
      logger.error('Session setup failed:', error.message);
      throw error;
    }
  }

  async navigateToNewStory() {
    try {
      // Click on profile icon
      await this.helpers.humanClick('button[data-testid="profileButton"]');
      
      // Wait for dropdown and click "Write a story"
      await this.helpers.page.waitForSelector('a[href*="new-story"]', { timeout: 10000 });
      await this.helpers.humanClick('a[href*="new-story"]');
      
      // Wait for editor to load
      await this.helpers.page.waitForSelector('div[contenteditable="true"]', { timeout: 15000 });
      
      logger.info('Navigated to new story editor');
    } catch (error) {
      logger.error('Navigation to new story failed:', error.message);
      throw error;
    }
  }

  async fillArticleContent(article) {
    try {
      // Type title with human-like behavior
      await this.helpers.humanType(article.title, 'input[placeholder="Title"]');
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Type content with human-like behavior
      const contentSelector = 'div[contenteditable="true"]';
      await this.helpers.humanType(article.content, contentSelector);
      
      logger.info('Article content filled');
      
      // Add some human-like pauses and scrolling
      await this.helpers.humanScroll();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      logger.error('Filling article content failed:', error.message);
      throw error;
    }
  }

  async verifyDraftSaved() {
    try {
      // Check for draft saved indicator
      const isSaved = await this.helpers.verifyDraftSaved();
      
      if (!isSaved) {
        logger.warn('Draft not saved, waiting and checking again...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        return await this.helpers.verifyDraftSaved();
      }
      
      logger.info('Draft saved successfully');
      return true;
    } catch (error) {
      logger.error('Draft verification failed:', error.message);
      return false;
    }
  }

  async publishArticle() {
    try {
      // Find and click publish button
      const publishButtonSelector = 'button:contains("Publish")';
      
      // Wait for publish button to be available
      await this.helpers.page.waitForSelector(publishButtonSelector, { timeout: 10000 });
      
      // Human-like click on publish
      await this.helpers.humanClick(publishButtonSelector);
      
      // Wait for publish confirmation dialog
      await this.helpers.page.waitForSelector('button:contains("Publish now")', { timeout: 10000 });
      
      // Click publish now
      await this.helpers.humanClick('button:contains("Publish now")');
      
      // Wait for publish to complete
      await this.helpers.page.waitForNavigation({ timeout: 30000 });
      
      logger.info('Article published');
      return true;
    } catch (error) {
      logger.error('Publish process failed:', error.message);
      return false;
    }
  }

  async getPublishedUrl() {
    try {
      const currentUrl = this.helpers.page.url();
      
      if (currentUrl.includes('medium.com/') && !currentUrl.includes('new-story')) {
        return currentUrl;
      }
      
      // If not on published page, try to extract from page content
      const url = await this.helpers.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const publishedLink = links.find(a => 
          a.href.includes('medium.com/') && 
          !a.href.includes('new-story') &&
          !a.href.includes('edit')
        );
        return publishedLink ? publishedLink.href : null;
      });
      
      if (url) {
        return url;
      }
      
      throw new Error('Could not determine published URL');
    } catch (error) {
      logger.error('Could not get published URL:', error.message);
      throw error;
    }
  }

  async handlePublishError(error, retryCount = 0) {
    try {
      // Take screenshot for debugging
      const screenshotPath = await this.helpers.screenshot('publish-error');
      
      if (retryCount < this.maxRetries) {
        logger.info(`Retrying publish (attempt ${retryCount + 1}/${this.maxRetries})...`);
        
        // Refresh page and try again
        await this.helpers.page.reload({ waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return await this.publishToMedium(article, cookies, retryCount + 1);
      } else {
        logger.error('Max retries reached, aborting publish');
        throw new Error('Publish failed after maximum retries');
      }
    } catch (retryError) {
      logger.error('Retry failed:', retryError.message);
      throw retryError;
    }
  }
}

module.exports = PublishingStealth;