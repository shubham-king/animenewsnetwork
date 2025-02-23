const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const LRU = require('lru-cache');

const app = express();
app.use(cors());

// Cache configuration (30 minutes)
const cache = new LRU({ max: 100, ttl: 1000 * 60 * 30 });

// 2024 Headers to bypass blocking
const SAFE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.8',
  'Referer': 'https://www.google.com/'
};

// Updated 2024 Selectors
const SELECTORS = {
  container: '.herald.box.news',
  title: 'div.header h3 a',
  date: 'time',
  author: 'div.byline span.editor',
  link: 'div.header a'
};

async function fetchNews() {
  try {
    const { data } = await axios.get('https://www.animenewsnetwork.com/news/', {
      headers: SAFE_HEADERS,
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const newsItems = [];

    $(SELECTORS.container).each((i, el) => {
      const $el = $(el);
      const title = $el.find(SELECTORS.title).text().trim();
      const path = $el.find(SELECTORS.link).attr('href');
      const date = $el.find(SELECTORS.date).attr('datetime');
      const author = $el.find(SELECTORS.author).text().trim();

      if (title && path) {
        newsItems.push({
          title,
          url: `https://www.animenewsnetwork.com${path}`,
          date: date || new Date().toISOString(),
          author: author || 'ANN Staff',
          timestamp: new Date(date).getTime() || Date.now()
        });
      }
    });

    return newsItems.slice(0, 10);
  } catch (error) {
    console.error('Scraping failed:', error.message);
    return [];
  }
}

app.get('/api/news', async (req, res) => {
  try {
    if (cache.has('news')) {
      return res.json(cache.get('news'));
    }

    const news = await fetchNews();
    if (news.length > 0) {
      cache.set('news', news);
      res.json(news);
    } else {
      res.status(503).json({ 
        error: 'News temporarily unavailable',
        cached: cache.get('news') || []
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

module.exports = app;
