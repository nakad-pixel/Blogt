const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const moment = require('moment');

const STATE_FILE = path.join(__dirname, '../../state.yaml');

class StateManager {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      const fileContents = fs.readFileSync(STATE_FILE, 'utf8');
      return yaml.load(fileContents);
    } catch (error) {
      console.error('Error loading state, creating default:', error.message);
      return {
        last_publish_date: null,
        last_topic_hash: null,
        topic_history: [],
        error_traces: [],
        consecutive_low_scores: 0
      };
    }
  }

  saveState() {
    try {
      const yamlContent = yaml.dump(this.state);
      fs.writeFileSync(STATE_FILE, yamlContent);
      return true;
    } catch (error) {
      console.error('Error saving state:', error.message);
      return false;
    }
  }

  canPublish() {
    if (!this.state.last_publish_date) return true;
    
    const lastPublish = moment(this.state.last_publish_date);
    const now = moment();
    const hoursSinceLastPublish = now.diff(lastPublish, 'hours');
    
    return hoursSinceLastPublish >= 24;
  }

  updateLastPublish(topicHash) {
    this.state.last_publish_date = moment().toISOString();
    this.state.last_topic_hash = topicHash;
    
    // Add to topic history
    if (!this.state.topic_history.includes(topicHash)) {
      this.state.topic_history.push(topicHash);
    }
    
    // Reset consecutive low scores on successful publish
    this.state.consecutive_low_scores = 0;
    
    return this.saveState();
  }

  incrementLowScores() {
    this.state.consecutive_low_scores += 1;
    return this.saveState();
  }

  resetLowScores() {
    this.state.consecutive_low_scores = 0;
    return this.saveState();
  }

  shouldAbort() {
    return this.state.consecutive_low_scores >= 3;
  }

  addErrorTrace(error) {
    const trace = {
      timestamp: moment().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    this.state.error_traces.push(trace);
    // Keep only last 10 errors
    if (this.state.error_traces.length > 10) {
      this.state.error_traces = this.state.error_traces.slice(-10);
    }
    
    return this.saveState();
  }

  isTopicProcessed(topicHash) {
    return this.state.topic_history.includes(topicHash);
  }

  addTopicToHistory(topicHash) {
    if (!this.state.topic_history.includes(topicHash)) {
      this.state.topic_history.push(topicHash);
      return this.saveState();
    }
    return true;
  }
}

module.exports = StateManager;