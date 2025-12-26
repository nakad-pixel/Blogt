export default {
  niche: 'ai_tools',
  
  // Scoring thresholds
  queue_threshold: 88,
  publish_threshold: 90,
  
  // Queue configuration
  queue_min: 3,
  queue_max: 14,
  
  // Content requirements
  content: {
    min_words: 1300,
    max_words: 1800,
    min_readability: 65,
    min_humanization: 85
  },
  
  // Affiliate configuration
  affiliate: {
    min_links: 2,
    max_links: 3
  },
  
  // Topic discovery sources
  sources: {
    reddit: {
      subreddits: ['artificial', 'MachineLearning', 'OpenAI', 'LocalLLaMA', 'StableDiffusion'],
      base_url: 'https://www.reddit.com/r/'
    },
    hackernews: {
      url: 'https://news.ycombinator.com/',
      filter: 'ai'
    },
    google_trends: {
      url: 'https://trends.google.com/trends/trendingsearches/daily',
      region: 'US'
    }
  },
  
  // Medium configuration
  medium: {
    api_url: 'https://api.medium.com/v1',
    login_url: 'https://medium.com/m/signin',
    editor_url: 'https://medium.com/new-story',
    publish_status: 'public',
    default_tags: ['AI', 'Artificial Intelligence', 'Technology', 'Machine Learning', 'Automation']
  },
  
  // OpenRouter configuration
  openrouter: {
    api_url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'anthropic/claude-3.5-sonnet',
    max_tokens: 4000,
    temperature: 0.7
  },
  
  // Retry and timeout configuration
  retry: {
    max_attempts: 3,
    initial_delay: 1000,
    max_delay: 10000,
    backoff_multiplier: 2
  },
  
  timeouts: {
    api_request: 60000,
    puppeteer_navigation: 30000,
    puppeteer_action: 10000,
    content_generation: 120000
  },
  
  // Puppeteer configuration
  puppeteer: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ],
    viewports: [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 }
    ],
    user_agents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  },
  
  // Semantic similarity threshold
  similarity_threshold: 0.85,
  
  // System prompts
  prompts: {
    content_generation: `You are a senior technical content writer specializing in AI tools and emerging technologies. Your writing is engaging, authoritative, and practical.

Write a comprehensive article that follows this structure:
1. Hook: Start with a compelling problem or insight
2. Problem Framing: Clearly define the challenge readers face
3. Why Existing Solutions Fall Short: Analyze current approaches
4. AI Tool Solutions: Present specific tools and how they solve the problem
5. Decision Guidance: Help readers choose the right solution
6. Call to Action: Clear next steps

Requirements:
- Length: 1300-1800 words
- Tone: Professional yet conversational
- Include specific examples and use cases
- Be opinionated but fair
- Focus on practical value
- Natural, human-like writing (no obvious AI patterns)
- No fluff or filler content

Avoid:
- Overly promotional language
- Generic advice
- Plagiarizing existing content
- Repetitive phrasing`,

    topic_evaluation: `You are an expert at evaluating content topics for engagement potential. Analyze the given topic and provide structured scoring based on:
- Demand signals (search volume, discussion activity)
- Competition level (existing content saturation)
- Trend velocity (is it growing or declining?)
- Affiliate potential (can we naturally recommend tools?)
- Problem-solution fit (clear pain point and solution)

Provide scores and reasoning.`,

    puppeteer_instructions: `Generate step-by-step instructions for publishing to Medium using browser automation. Return valid JSON array of steps.

Each step must have:
{
  "action": "navigate|click|type|wait|scroll",
  "selector": "CSS selector or null",
  "value": "value for type actions or null",
  "delay": milliseconds,
  "description": "what this step does"
}

Make actions human-like with realistic delays (10-150ms for typing, 500-2000ms between actions).`
  }
};
