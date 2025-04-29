// weatherRoutes.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Get your API key from environment variables
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'd64f16538655b7a8d0b91db23b1cc0c6';

// Current weather endpoint
router.get('/current', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching current weather:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather data',
      message: error.message 
    });
  }
});

// Forecast endpoint
router.get('/forecast', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching forecast:', error);
    res.status(500).json({ 
      error: 'Failed to fetch forecast data',
      message: error.message 
    });
  }
});

export default router;