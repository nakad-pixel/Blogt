import logger from './logger.js';

export class BlogtError extends Error {
  constructor(message, category, originalError = null, recoverable = false) {
    super(message);
    this.name = 'BlogtError';
    this.category = category;
    this.originalError = originalError;
    this.recoverable = recoverable;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? {
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null
    };
  }
}

export const ERROR_CATEGORIES = {
  API_FAILURE: 'API_FAILURE',
  PUPPETEER_FAILURE: 'PUPPETEER_FAILURE',
  CONTENT_VALIDATION_FAILURE: 'CONTENT_VALIDATION_FAILURE',
  AFFILIATE_FAILURE: 'AFFILIATE_FAILURE',
  STATE_MANAGEMENT_FAILURE: 'STATE_MANAGEMENT_FAILURE',
  NETWORK_FAILURE: 'NETWORK_FAILURE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  UNKNOWN: 'UNKNOWN'
};

export class ErrorHandler {
  constructor() {
    this.errorLog = [];
  }

  handle(error, context = '') {
    const blogtError = error instanceof BlogtError 
      ? error 
      : new BlogtError(
          error.message || 'Unknown error',
          ERROR_CATEGORIES.UNKNOWN,
          error,
          false
        );

    const errorEntry = {
      ...blogtError.toJSON(),
      context
    };

    this.errorLog.push(errorEntry);
    logger.error(`Error in ${context}: ${blogtError.message}`, errorEntry);

    return blogtError;
  }

  async withRetry(fn, maxAttempts = 3, delay = 1000, context = '') {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`Attempt ${attempt}/${maxAttempts} for: ${context}`);
        const result = await fn();
        if (attempt > 1) {
          logger.info(`Succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxAttempts) {
          const waitTime = delay * Math.pow(2, attempt - 1);
          logger.info(`Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        }
      }
    }

    const finalError = this.handle(lastError, context);
    throw finalError;
  }

  async withFallback(primaryFn, fallbackFn, context = '') {
    try {
      logger.info(`Trying primary method: ${context}`);
      return await primaryFn();
    } catch (primaryError) {
      logger.warn(`Primary method failed, trying fallback: ${primaryError.message}`);
      
      try {
        const result = await fallbackFn();
        logger.info(`Fallback succeeded for: ${context}`);
        return result;
      } catch (fallbackError) {
        logger.error(`Both primary and fallback failed for: ${context}`);
        throw this.handle(fallbackError, `${context} (fallback)`);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getErrorLog() {
    return this.errorLog;
  }

  clearErrorLog() {
    this.errorLog = [];
  }
}

const errorHandler = new ErrorHandler();

export default errorHandler;
