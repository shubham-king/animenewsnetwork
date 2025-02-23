// scraper.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core'); // Use core for Vercel compatibility

const app = express();
app.use(cors());

// Randomized headers
const getRandomHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
});

// Puppeteer scraping with stealth
async function scrapeWithBrowser() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders(getRandomHeaders());
    await page.goto('https://www.animenewsnetwork.com/news/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Add random human-like delays
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    return await page.evaluate(() => document.body.innerHTML);
  } finally {
    await browser.close();
  }
}

// Updated parser for 2024 layout
function parseContent(html) {
  const $ = cheerio.load(html);
  const newsItems = [];

  $('.herald.box.news').each((i, el) => {
    const $el = $(el);
    const title = $el.find('.header a').text().trim();
    const url = $el.find('.header a').attr('href');
    const date = $el.find('.byline time').attr('datetime');
    const author = $el.find('.byline .editor').text().trim();

    if (title && url) {
      newsItems.push({
        title,
        url: url.startsWith('http') ? url : `https://www.animenewsnetwork.com${url}`,
        date,
        author: author || 'ANN Staff',
        timestamp: new Date(date).toISOString()
      });
    }
  });

  return newsItems.slice(0, 10);
}

// Cached scraping
let cachedNews = [];
let lastFetch = 0;

async function refreshNews() {
  try {
    const html = await scrapeWithBrowser();
    cachedNews = parseContent(html);
    lastFetch = Date.now();
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  }
}

// API endpoint
app.get('/api/news', async (req, res) => {
  try {
    // Cache for 1 hour
    if (Date.now() - lastFetch > 3600000) {
      await refreshNews();
    }
    
    res.json(cachedNews);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch news',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = app;
