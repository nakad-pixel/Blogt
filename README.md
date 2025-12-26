# Blogt - Autonomous Blog Automation System

A fully autonomous blog automation system that discovers trending AI topics, generates high-quality content, and publishes daily articles to Medium with **zero manual intervention**.

## 🚀 Features

- **Autonomous Topic Discovery**: Scrapes Reddit, Hacker News, and Google Trends for trending AI topics
- **Intelligent Scoring System**: Multi-factor scoring (PES, FES, FES2) to select the best topics
- **AI-Powered Content Generation**: Uses OpenRouter/Claude to generate 1300-1800 word articles
- **Automatic Affiliate Integration**: Contextually inserts relevant affiliate links
- **Dual Publishing Methods**: 
  - Primary: Medium API
  - Fallback: Puppeteer-based browser automation with stealth mode
- **Draft Queue Management**: Maintains 3-14 drafts ready for publishing
- **GitHub Actions Integration**: Runs daily at 9 AM UTC automatically
- **State Management**: YAML-based state tracking with git commits
- **Comprehensive Logging**: Structured logging with security redaction

## 📋 Requirements

- Node.js 20+
- GitHub repository with Actions enabled
- Medium account with Integration Token
- OpenRouter API key (for Claude/GPT access)

## 🔧 Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd blogt
npm install
```

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

**Required:**
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `MEDIUM_INTEGRATION_TOKEN` - Medium Integration Token (from Settings → Integration tokens)

**Optional:**
- `MEDIUM_USERNAME` - Medium email (for Puppeteer fallback)
- `MEDIUM_PASSWORD` - Medium password (for Puppeteer fallback)
- `AFFILIATE_API_KEY` - For future affiliate network integration
- `SLACK_WEBHOOK_URL` - For failure notifications

### 3. Enable GitHub Actions

1. Go to your repository's Actions tab
2. Enable workflows if prompted
3. The workflow will run automatically daily at 9 AM UTC
4. You can also trigger manually via "Run workflow" button

## 🏗️ Architecture

```
src/
├── orchestrator.js           # Main workflow coordinator
├── modules/
│   ├── topicDiscovery.js    # Scrapes trending topics
│   ├── scoringEngine.js     # Calculates PES/FES/FES2 scores
│   ├── contentGenerator.js  # Generates articles via OpenRouter
│   ├── affiliateEngine.js   # Inserts affiliate links
│   ├── draftQueueManager.js # Manages draft queue
│   └── publisher.js         # Publishes to Medium
└── utils/
    ├── logger.js            # Structured logging
    ├── errorHandler.js      # Error handling & retries
    ├── security.js          # Secret management & stealth
    ├── stateManager.js      # YAML state management
    └── slack-notifier.js    # Slack notifications
```

## 📊 Scoring System

### PES (Problem Engagement Score)
- **Formula**: `(DemandScore × 0.6) + (CompetitionScore × 0.4)`
- Baseline engagement potential

### FES (Forecast Engagement Score)
- **Formula**: `(TopicScore × 0.4) + (AffiliateScore × 0.3) + (EngagementScore × 0.2) + (TrendVelocity × 0.1)`
- Predicted engagement

### FES2 (Final Execution Score)
- **Formula**: `(TopicScore × 0.35) + (AffiliateScore × 0.25) + (EngagementScore × 0.20) + (TrendVelocity × 0.10) + (PES × 0.10)`
- Final decision metric
- **Queue Threshold**: ≥88
- **Publish Threshold**: ≥90

## 🔄 Workflow

1. **Check if published today** → Skip if yes
2. **Validate secrets** → Ensure all required secrets exist
3. **Load state** → Read current queue and metrics
4. **Check draft queue** → Refill if < 3 drafts
5. **Select top draft** → Pick highest FES2 score ≥90
6. **Publish article** → Try API, fallback to Puppeteer
7. **Update state** → Mark published, remove from queue
8. **Commit changes** → Push state.yaml to repo
9. **Log execution** → Save logs as artifacts

## 📝 State Management

All state is stored in `state.yaml`:

```yaml
niche: "ai_tools"
last_publish_date: "2024-01-15"
published_topics_hashes: [...]
draft_queue:
  - topic: "..."
    title: "..."
    fes2_score: 92
    content: "..."
    affiliate_links: [...]
metrics:
  pes: 85
  fes: 88
  fes2: 92
```

## 🎯 Content Quality Standards

- **Word Count**: 1300-1800 words
- **Readability Score**: ≥65 (Flesch Reading Ease)
- **Humanization Score**: ≥85 (natural, non-AI writing)
- **Structure**: Problem → Why it matters → AI solutions → Decision guidance → CTA
- **Affiliate Links**: 2-3 contextually relevant links

## 🛡️ Security Features

- Secrets loaded from environment only (never hardcoded)
- Automatic redaction in all logs
- Puppeteer stealth plugin to avoid detection
- Random viewport sizes, user agents, and timing
- Human-like typing delays (30-120ms per character)

## 🐛 Debugging

### View Logs

1. **GitHub Actions**: Check workflow run logs
2. **Artifacts**: Download `execution-logs` artifact from workflow runs
3. **Local**: Run `npm start` to test locally (requires `.env` file)

### Common Issues

**"Missing required secrets"**
- Ensure all required secrets are set in GitHub repository settings

**"Queue below minimum"**
- Topic discovery may have failed, check logs for scraping errors
- Topics may be filtered due to similarity or saturation

**"No draft meets publish threshold"**
- Current drafts have FES2 < 90, queue will refill on next run

**"Medium API error"**
- Verify Integration Token is valid
- Check Medium API status
- Fallback to Puppeteer should trigger automatically

## 📈 Monitoring

- **Slack Notifications**: Set `SLACK_WEBHOOK_URL` for failure alerts
- **GitHub Actions Email**: Enable email notifications in GitHub settings
- **Log Artifacts**: Automatically uploaded on every run (retained 30 days)

## 🔄 Manual Triggers

Trigger the workflow manually:

```bash
# Via GitHub UI
Actions → Publish Daily Article → Run workflow

# Via GitHub CLI
gh workflow run publish-daily.yml
```

## 🧪 Local Development

Create `.env` file:

```bash
OPENROUTER_API_KEY=your_key_here
MEDIUM_INTEGRATION_TOKEN=your_token_here
MEDIUM_USERNAME=your_email
MEDIUM_PASSWORD=your_password
```

Run locally:

```bash
npm start
```

## 📄 License

MIT

## 🤝 Contributing

This is an autonomous system designed to run without intervention. Contributions for improvements are welcome via pull requests.

## ⚠️ Disclaimer

- Ensure compliance with Medium's Terms of Service
- Review and adjust affiliate links in `state.yaml`
- Monitor published content quality regularly
- OpenRouter usage incurs costs based on token usage

## 🎉 Credits

Built with:
- [Puppeteer](https://pptr.dev/) + Stealth Plugin
- [OpenRouter](https://openrouter.ai/) (Claude 3.5 Sonnet)
- [GitHub Actions](https://github.com/features/actions)
- Medium API

---

**Status**: Production Ready ✅

For support or questions, open an issue in this repository.
