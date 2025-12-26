const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');

puppeteer.use(StealthPlugin());

class PuppeteerHelpers {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--window-size=1200,800'
      ]
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1200, height: 800 });
    
    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async humanType(text, selector) {
    await this.page.focus(selector);
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Add random delay (30-150ms)
      const delay = 30 + Math.random() * 120;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 1% chance of typo/correction
      if (Math.random() < 0.01) {
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        await this.page.keyboard.press(wrongChar);
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.page.keyboard.press('Backspace');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      await this.page.keyboard.press(char);
    }
  }

  async humanClick(selector) {
    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    const box = await element.boundingBox();
    
    // Add random offset to click position
    const offsetX = box.width * (0.3 + Math.random() * 0.4);
    const offsetY = box.height * (0.3 + Math.random() * 0.4);
    
    // Bezier curve mouse movement
    await this.page.mouse.move(
      box.x + offsetX,
      box.y + offsetY,
      { steps: 10 + Math.floor(Math.random() * 10) }
    );
    
    // Random delay before click
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    await this.page.mouse.click(box.x + offsetX, box.y + offsetY);
  }

  async humanScroll() {
    // Non-linear scrolling with variable velocity
    const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await this.page.evaluate(() => window.innerHeight);
    
    for (let i = 0; i < scrollHeight; i += viewportHeight * 0.8) {
      await this.page.mouse.wheel({ deltaY: viewportHeight * 0.8 });
      
      // Variable delay between scrolls
      const delay = 200 + Math.random() * 300;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  async screenshot(filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `screenshot-${timestamp}-${filename}.png`;
    
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`Screenshot saved: ${screenshotPath}`);
    
    return screenshotPath;
  }

  async waitForElement(selector, timeout = 30000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      logger.error(`Element not found within timeout: ${selector}`);
      return false;
    }
  }

  async verifyDraftSaved() {
    // Look for "Draft saved" indicator
    const draftSaved = await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => 
        el.textContent && el.textContent.toLowerCase().includes('draft saved')
      );
    });
    
    return draftSaved;
  }
}

module.exports = PuppeteerHelpers;