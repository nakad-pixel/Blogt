import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.logFile = path.join(this.logDir, 'execution.log');
    this.currentLevel = LOG_LEVELS.INFO;
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      formatted += '\n' + JSON.stringify(data, null, 2);
    }
    
    return formatted;
  }

  redactSecrets(message) {
    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }
    
    // Redact common secret patterns
    const patterns = [
      /sk-[a-zA-Z0-9]{32,}/g,
      /Bearer\s+[a-zA-Z0-9_\-\.]+/g,
      /api[_-]?key["\s:=]+[a-zA-Z0-9_\-]+/gi,
      /token["\s:=]+[a-zA-Z0-9_\-\.]+/gi,
      /password["\s:=]+[^\s"]+/gi
    ];
    
    let redacted = message;
    patterns.forEach(pattern => {
      redacted = redacted.replace(pattern, '[REDACTED]');
    });
    
    return redacted;
  }

  writeToFile(message) {
    try {
      const redacted = this.redactSecrets(message);
      fs.appendFileSync(this.logFile, redacted + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  writeToConsole(level, message) {
    const redacted = this.redactSecrets(message);
    
    switch (level) {
      case 'ERROR':
        console.error(redacted);
        break;
      case 'WARN':
        console.warn(redacted);
        break;
      default:
        console.log(redacted);
    }
  }

  log(level, message, data = null) {
    if (LOG_LEVELS[level] < this.currentLevel) {
      return;
    }
    
    const formatted = this.formatMessage(level, message, data);
    this.writeToConsole(level, formatted);
    this.writeToFile(formatted);
  }

  debug(message, data = null) {
    this.log('DEBUG', message, data);
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  warn(message, data = null) {
    this.log('WARN', message, data);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
  }

  section(title) {
    const separator = '='.repeat(80);
    this.info(separator);
    this.info(`  ${title}`);
    this.info(separator);
  }
}

const logger = new Logger();

export default logger;
