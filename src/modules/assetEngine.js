const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { Client } = require('node-pexels');

class AssetEngine {
  constructor() {
    this.pexelsApiKey = process.env.PEXELS_API_KEY;
    this.baseUrl = 'https://api.pexels.com/v1';
    this.client = new Client({ apiKey: this.pexelsApiKey });
  }

  async findImageForTopic(topic) {
    try {
      const photos = await this.client.photos.search({ 
        query: topic, 
        per_page: 1, 
        orientation: 'landscape' 
      });
      
      if (photos.photos && photos.photos.length > 0) {
        const photo = photos.photos[0];
        return {
          url: photo.src.large,
          photographer: photo.photographer,
          id: photo.id
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Pexels API error:', error.message);
      return null;
    }
  }

  async downloadImage(imageUrl, filename) {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      
      const imagePath = path.join(__dirname, '../../assets', filename);
      
      // Ensure assets directory exists
      if (!fs.existsSync(path.dirname(imagePath))) {
        fs.mkdirSync(path.dirname(imagePath), { recursive: true });
      }
      
      fs.writeFileSync(imagePath, response.data);
      logger.info(`Image downloaded: ${imagePath}`);
      
      return imagePath;
    } catch (error) {
      logger.error('Image download failed:', error.message);
      return null;
    }
  }

  async getImageForArticle(topic) {
    try {
      // Find image
      const imageInfo = await this.findImageForTopic(topic);
      if (!imageInfo) {
        logger.warn('No suitable image found for topic:', topic);
        return null;
      }
      
      // Download image
      const filename = `article-${Date.now()}-${imageInfo.id}.jpg`;
      const localPath = await this.downloadImage(imageInfo.url, filename);
      
      if (!localPath) {
        return null;
      }
      
      return {
        localPath: localPath,
        url: imageInfo.url,
        photographer: imageInfo.photographer,
        attribution: `Photo by ${imageInfo.photographer} from Pexels`
      };
    } catch (error) {
      logger.error('Error getting image for article:', error.message);
      return null;
    }
  }

  async uploadToMediumCDN(imagePath) {
    // In a real implementation, this would use Medium's API
    // For this demo, we'll simulate the process
    logger.info(`Simulating upload of ${imagePath} to Medium CDN`);
    
    return {
      cdnUrl: `https://cdn.medium.com/${Date.now()}-${path.basename(imagePath)}`,
      success: true
    };
  }
}

module.exports = AssetEngine;