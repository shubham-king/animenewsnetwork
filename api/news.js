const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const LRU = require('lru-cache');

const app = express();
app.use(cors());

// Configure cache (1 hour TTL)
const cache = new LRU({
  max: 100,
  ttl: 1000 * 60 * 60,
});

// Mobile user agent to bypass bot detection
const MOBILE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Accept-Language': 'en-US,en;q=0.9'
};

// Updated 2024 Selectors
const SELECTORS = {
  container: '.herald.box.news',
  title: '.header a',
  date: 'time',
  author: '.byline .editor',
  link: '.header a'
};

async function scrapeLatestNews() {
  try {
    const { data } = await axios.get('https://www.animenewsnetwork.com/news/', {
      headers: MOBILE_HEADERS,
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const news = [];

    $(SELECTORS.container).each((i, el) => {
      const $el = $(el);
      const title = $el.find(SELECTORS.title).text().trim();
      const path = $el.find(SELECTORS.link).attr('href');
      const date = $el.find(SELECTORS.date).attr('datetime');
      const author = $el.find(SELECTORS.author).text().trim();

      if (title && path) {
        news.push({
          title,
          url: `https://www.animenewsnetwork.com${path}`,
          date: date || new Date().toISOString(),
          author: author || 'ANN Staff',
          timestamp: new Date(date).getTime()
        });
      }
    });

    return news.slice(0, 10);
  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error('Failed to fetch news');
  }
}

app.get('/api/news', async (req, res) => {
  try {
    // Check cache first
    if (cache.has('latest')) {
      return res.json(cache.get('latest'));
    }

    // Scrape fresh data
    const news = await scrapeLatestNews();
    cache.set('latest', news);
    
    res.json(news);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      retryAfter: 300 // 5 minutes
    });
  }
});

module.exports = app;
