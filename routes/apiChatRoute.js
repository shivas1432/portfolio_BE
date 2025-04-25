import express from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const router = express.Router();

router.use(cors({ origin: 'http://localhost:3000' }));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again later.',
  handler: (req, res) => {
    console.warn(`Rate limit exceeded by IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

const callGeminiWithRetry = async (message, retries = 3) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is missing');
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(apiUrl, {
        contents: [
          {
            parts: [{ text: message }]
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.candidates && response.data.candidates.length > 0) {
        const candidate = response.data.candidates[0];
        const contentObject = candidate.content;

        if (contentObject && Array.isArray(contentObject.parts) && contentObject.parts.length > 0) {
          const generatedText = contentObject.parts.map(part => part.text).join(' ');
          return generatedText;
        } else {
          throw new Error('Content parts are not in the expected format');
        }
      } else {
        throw new Error('Unexpected response structure from Gemini API');
      }
    } catch (error) {
      if (error.response && error.response.status === 429) {
        const waitTime = Math.min(Math.pow(2, i) * 1000, 16000);
        console.log(`Rate limit hit, retrying in ${waitTime} ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
};

router.post('/', apiLimiter, async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid message input' });
  }

  try {
    const chatResponse = await callGeminiWithRetry(message);
    return res.json({ response: chatResponse });
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);

    if (error.response) {
      if (error.response.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded, please try again later.' });
      }
      if (error.response.status >= 500) {
        return res.status(500).json({ error: 'Internal server error from Gemini. Please try again later.' });
      }
    }

    res.status(500).json({
      error: 'Unable to get a response from Gemini. ' + error.message
    });
  }
});

export default router;
