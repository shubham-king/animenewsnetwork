const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');

const app = express();
app.use(cors());

// Configuration
const ANN_URL = 'https://www.animenewsnetwork.com/news/';
const CACHE_TTL = 3600000; // 1 hour
const PUPPETEER_OPTIONS = {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security'
  ]
};

// State management
let cachedData = [];
let lastFetchTime = 0;

// Stealth headers template
const getStealthHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
});

async function scrapeNews() {
  const browser = await puppeteer.launch(PUPPETEER_OPTIONS);
  const page = await browser.newPage();

  try {
    // Bypass bot detection
    await page.setExtraHTTPHeaders(getStealthHeaders());
    await page.evaluateOnNewDocument(() => {
      delete navigator.__proto__.webdriver;
    });

    // Navigate with random delay
    await page.goto(ANN_URL, {
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    // Wait for dynamic content
    await page.waitForSelector('.herald', { timeout: 15000 });
    await page.waitForTimeout(2000 + Math.random() * 3000);

    // Get page content
    const html = await page.content();
    const $ = cheerio.load(html);

    // Updated 2024 selectors
    const newsItems = [];
    $('.herald.box.news').each((i, el) => {
      const $item = $(el);
      const title = $item.find('.header a').text().trim();
      const path = $item.find('.header a').attr('href');
      const date = $item.find('time').attr('datetime');
      const author = $item.find('.byline .editor').text().trim();

      if (title && path) {
        newsItems.push({
          title,
          url: `https://www.animenewsnetwork.com${path}`,
          date,
          author: author || 'ANN Staff',
          timestamp: new Date(date).toISOString()
        });
      }
    });

    return newsItems.slice(0, 10);
  } finally {
    await browser.close();
  }
}

// API endpoint
app.get('/api/news', async (req, res) => {
  try {
    // Cache management
    if (Date.now() - lastFetchTime > CACHE_TTL) {
      cachedData = await scrapeNews();
      lastFetchTime = Date.now();
    }
    
    res.json(cachedData);
  } catch (error) {
    console.error('Scraper error:', error);
    res.status(500).json({
      error: 'Failed to fetch news',
      retryAfter: Math.floor(Math.random() * 60) + 30
    });
  }
});

module.exports = app;
