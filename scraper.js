const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());

const ANN_URL = 'https://www.animenewsnetwork.com/news/';

async function scrapeNews() {
  try {
    const { data } = await axios.get(ANN_URL);
    const $ = cheerio.load(data);
    const newsItems = [];

    $('.newsfeed-unit').each((i, el) => {
      const title = $(el).find('.caption a').text().trim();
      const url = $(el).find('.caption a').attr('href');
      const fullUrl = url.startsWith('http') ? url : `https://www.animenewsnetwork.com${url}`;
      const date = $(el).find('.byline time').attr('datetime');
      const author = $(el).find('.byline .editor').text().trim();

      newsItems.push({
        title,
        url: fullUrl,
        date,
        author,
        timestamp: new Date(date).toISOString()
      });
    });

    return newsItems.slice(0, 10); // Return latest 10 news
  } catch (error) {
    console.error('Scraping error:', error);
    return [];
  }
}

app.get('/api/news', async (req, res) => {
  try {
    const news = await scrapeNews();
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

module.exports = app;
