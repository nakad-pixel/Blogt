const { exec } = require('child_process');
const logger = require('./logger');
const axios = require('axios');

class CloudflareWarp {
  constructor() {
    this.warpConnected = false;
    this.validatedIP = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      logger.info('Connecting to Cloudflare WARP...');
      
      const warpProcess = exec('warp-cli connect', (error, stdout, stderr) => {
        if (error) {
          logger.error('WARP connection error:', stderr);
          return reject(new Error('Failed to connect to Cloudflare WARP'));
        }
        
        logger.info('WARP connected successfully');
        this.warpConnected = true;
        
        // Wait 20 seconds for handshake as specified
        setTimeout(() => resolve(true), 20000);
      });
      
      warpProcess.stdout.on('data', (data) => logger.info(data.toString()));
      warpProcess.stderr.on('data', (data) => logger.error(data.toString()));
    });
  }

  async validateIP() {
    try {
      const response = await axios.get('https://api.ipify.org?format=json');
      const ip = response.data.ip;
      
      logger.info(`Current IP: ${ip}`);
      
      // Check if IP is in Microsoft/Azure ranges
      const isMicrosoftIP = await this.checkMicrosoftIP(ip);
      
      if (isMicrosoftIP) {
        logger.error('IP is in Microsoft/Azure range - aborting for safety');
        this.validatedIP = false;
        return false;
      }
      
      logger.info('IP validation passed - not in Microsoft/Azure ranges');
      this.validatedIP = true;
      return true;
    } catch (error) {
      logger.error('IP validation failed:', error.message);
      return false;
    }
  }

  async checkMicrosoftIP(ip) {
    // Microsoft/Azure IP ranges (simplified check)
    const microsoftRanges = [
      '20.0.0.0/8',
      '23.96.0.0/14',
      '40.0.0.0/8',
      '51.10.0.0/16',
      '51.140.0.0/16',
      '52.100.0.0/14',
      '104.40.0.0/14',
      '137.116.0.0/16'
    ];
    
    // Simple IP range check (for demo purposes)
    // In production, use proper IP range checking
    return microsoftRanges.some(range => {
      const [rangeIP] = range.split('/');
      return ip.startsWith(rangeIP.split('.').slice(0, 2).join('.'));
    });
  }

  async disconnect() {
    return new Promise((resolve, reject) => {
      exec('warp-cli disconnect', (error, stdout, stderr) => {
        if (error) {
          logger.error('WARP disconnection error:', stderr);
          return reject(new Error('Failed to disconnect from Cloudflare WARP'));
        }
        
        logger.info('WARP disconnected successfully');
        this.warpConnected = false;
        resolve(true);
      });
    });
  }

  isConnected() {
    return this.warpConnected && this.validatedIP;
  }
}

module.exports = CloudflareWarp;