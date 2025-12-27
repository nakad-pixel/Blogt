const Orchestrator = require('./modules/orchestrator');
const logger = require('./utils/logger');

async function main() {
  try {
    const orchestrator = new Orchestrator();
    const result = await orchestrator.run();
    
    if (result.success) {
      logger.info('Blogt ARE completed successfully');
      logger.info(`Published article: ${result.url}`);
      process.exit(0);
    } else {
      logger.warn(`Blogt ARE completed with status: ${result.reason}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Fatal error in Blogt ARE:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };