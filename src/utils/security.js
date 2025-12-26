import logger from './logger.js';
import { BlogtError, ERROR_CATEGORIES } from './errorHandler.js';

class Security {
  constructor() {
    this.requiredSecrets = [
      'OPENROUTER_API_KEY',
      'MEDIUM_INTEGRATION_TOKEN'
    ];
    
    this.optionalSecrets = [
      'MEDIUM_USERNAME',
      'MEDIUM_PASSWORD',
      'AFFILIATE_API_KEY',
      'SLACK_WEBHOOK_URL'
    ];
  }

  validateSecrets() {
    logger.info('Validating required secrets...');
    
    const missing = [];
    const present = [];

    this.requiredSecrets.forEach(secret => {
      if (!process.env[secret]) {
        missing.push(secret);
      } else {
        present.push(secret);
      }
    });

    if (missing.length > 0) {
      throw new BlogtError(
        `Missing required secrets: ${missing.join(', ')}`,
        ERROR_CATEGORIES.CONFIGURATION_ERROR,
        null,
        false
      );
    }

    logger.info(`All required secrets validated: ${present.join(', ')}`);

    const optionalPresent = [];
    this.optionalSecrets.forEach(secret => {
      if (process.env[secret]) {
        optionalPresent.push(secret);
      }
    });

    if (optionalPresent.length > 0) {
      logger.info(`Optional secrets available: ${optionalPresent.join(', ')}`);
    }

    return true;
  }

  getSecret(name) {
    const value = process.env[name];
    if (!value && this.requiredSecrets.includes(name)) {
      throw new BlogtError(
        `Required secret ${name} is not available`,
        ERROR_CATEGORIES.CONFIGURATION_ERROR,
        null,
        false
      );
    }
    return value;
  }

  hasSecret(name) {
    return !!process.env[name];
  }

  getRandomViewport() {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 }
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  getRandomDelay(min = 10, max = 150) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  humanizeTyping(text, page) {
    return new Promise(async (resolve) => {
      for (const char of text) {
        await page.keyboard.type(char, { delay: this.getRandomDelay(30, 120) });
      }
      resolve();
    });
  }
}

const security = new Security();

export default security;
