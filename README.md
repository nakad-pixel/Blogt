# Blogt - Autonomous Revenue Engine (ARE)

A complete, self-healing automation suite for autonomous Medium publication management.

## Overview

Blogt ARE handles niche research, expert-level writing, professional asset sourcing, and stealth publishing without manual intervention via GitHub Actions.

## Features

### 1. Topic Discovery Engine
- Multi-source scraping: Google Trends, Reddit, HN
- Semantic deduplication against `state.yaml` history
- FES2 (Forecast Engagement Score v2) scoring model
- Queue threshold: score > 88
- Publish threshold: score > 90

### 2. Content Generation
- OpenRouter API integration with free-tier models
- Content specifications:
  - Length: 1300-1800 words
  - Readability: Flesch-Kincaid > 65
  - Humanization: Variable sentence length, idiosyncratic transitions, technical jargon
- Asset sourcing: Pexels API for images

### 3. Publishing & Stealth Behavior
- GitHub Actions environment with Cloudflare WARP CLI
- Session management: JSON Cookie Injection
- Behavioral mimicry:
  - Humanized typing with randomized jitter
  - Non-linear scrolling with variable velocity
  - Bezier-curve mouse movements
- Safe publishing with verification and retries

### 4. State Management
- Git-based persistence: `state.yaml`
- Tracks: `last_publish_date`, topic history, error traces
- Prevents double-posting within 24-hour cycles
- Auto-aborts if FES2 scores < threshold for 3 consecutive days

## Architecture

```
blogt/
├── src/
│   ├── modules/
│   │   ├── topicDiscovery.js      # Multi-source scraping + FES2 scoring
│   │   ├── contentGeneration.js   # OpenRouter API + humanization
│   │   ├── assetEngine.js         # Pexels API + image processing
│   │   ├── publishingStealth.js   # Puppeteer-extra + behavioral mimicry
│   │   ├── stateManager.js        # state.yaml read/write
│   │   └── orchestrator.js        # Main workflow controller
│   ├── utils/
│   │   ├── openrouter.js          # OpenRouter client
│   │   ├── puppeteerHelpers.js    # Human typing, scrolling, etc.
│   │   ├── cloudflareWarp.js      # WARP CLI integration
│   │   └── logger.js              # Structured logging
│   └── index.js                   # Entry point
├── state.yaml                      # Persistent state
├── .github/workflows/are-publish.yml # GitHub Actions workflow
└── package.json
```

## Setup

### Prerequisites
- Node.js 20+
- GitHub repository
- Required GitHub Actions secrets:
  - `OPENROUTER_KEY_A` (primary content generation)
  - `OPENROUTER_KEY_B` (topic scoring + fallback)
  - `PEXELS_API_KEY` (image sourcing)
  - `MEDIUM_COOKIES_JSON` (session auth)

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up GitHub Actions secrets
4. Configure `state.yaml` if needed

### Running Locally
```bash
npm start
```

### Running in GitHub Actions
The workflow runs daily at 12:00 UTC and can be manually triggered.

## Configuration

### Environment Variables
- `OPENROUTER_KEY_A`: Primary OpenRouter API key
- `OPENROUTER_KEY_B`: Fallback OpenRouter API key  
- `PEXELS_API_KEY`: Pexels API key for image sourcing
- `MEDIUM_COOKIES_JSON`: JSON string of Medium cookies for authentication

### State Management
The `state.yaml` file tracks:
- `last_publish_date`: Last successful publish timestamp
- `last_topic_hash`: Hash of last published topic
- `topic_history`: Array of processed topic hashes
- `error_traces`: Recent error information
- `consecutive_low_scores`: Counter for auto-abort logic

## Operational Logic

1. **Initialization**: Verify Cloudflare WARP, validate IP, load state
2. **Topic Discovery**: Scrape sources, score with FES2, filter by thresholds
3. **Content Generation**: Generate article, validate quality metrics
4. **Asset Sourcing**: Find and download relevant images
5. **Publishing**: Stealth publishing with behavioral mimicry
6. **State Update**: Save successful publish information

## Safety Features

- **24-hour cooldown**: Prevents duplicate publishing
- **Auto-abort**: Stops after 3 consecutive low FES2 scores
- **IP validation**: Ensures not using Microsoft/Azure IP ranges
- **Error recovery**: Screenshots, retries, and graceful failure
- **Secret protection**: Zero-log secrets, never exposed in logs

## Success Criteria

- Clean exit code 0
- Published URL verified in logs
- `state.yaml` updated with new topic hash
- No secrets exposed in logs
- One post per 24-hour cycle maintained

## License

MIT

## Support

For issues or questions, please open a GitHub issue.