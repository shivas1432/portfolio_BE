import express from 'express';
import { queryWithRetry, healthCheck } from '../config/db.js';

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();
    if (health.status === 'healthy') {
      res.json(health);
    } else {
      res.status(500).json(health);
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      message: 'Health check failed',
      error: error.message 
    });
  }
});

// GET /api/reviews - Get all reviews grouped by category
router.get('/', async (req, res) => {
  try {
    console.log('Fetching reviews from database...');
    const { category } = req.query;
    
    let query = `
      SELECT r.*, p.program_name 
      FROM reviews r 
      LEFT JOIN programs p ON r.program_id = p.id 
    `;
    
    const params = [];
    
    if (category && category !== 'all') {
      query += ` WHERE r.category = ? `;
      params.push(category);
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    // Use retry logic for reliable querying
    const reviews = await queryWithRetry(query, params, 3, 15000);
    
    // Group reviews by category for frontend
    const groupedReviews = {
      stack360: [],
      career360: [],
      core360: [],
      general: []
    };
    
    reviews.forEach(review => {
      // Safe JSON parsing for skills with error handling
      let parsedSkills = [];
      if (review.skills) {
        try {
          if (typeof review.skills === 'string') {
            parsedSkills = JSON.parse(review.skills);
          } else if (Array.isArray(review.skills)) {
            parsedSkills = review.skills;
          } else {
            parsedSkills = [];
          }
          
          if (!Array.isArray(parsedSkills)) {
            parsedSkills = [];
          }
        } catch (jsonError) {
          console.log(`Invalid JSON in skills for review ${review.id}: "${review.skills}"`);
          parsedSkills = [];
        }
      }

      const reviewData = {
        id: review.id,
        name: review.reviewer_name,
        role: review.reviewer_role || '',
        program: review.program_name || '',
        rating: review.rating,
        date: formatDate(review.created_at),
        review: review.review_text,
        avatar: review.avatar || generateInitials(review.reviewer_name),
        skills: parsedSkills
      };
      
      if (groupedReviews[review.category]) {
        groupedReviews[review.category].push(reviewData);
      }
    });
    
    console.log('Reviews fetched successfully:', Object.keys(groupedReviews).map(key => `${key}: ${groupedReviews[key].length}`));
    res.json(groupedReviews);
    
  } catch (error) {
    console.error('Error fetching reviews:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: 'Unable to fetch reviews. Please try again later.',
      details: error.message
    });
  }
});

// POST /api/reviews - Add a new review
router.post('/', async (req, res) => {
  try {
    const {
      reviewer_name,
      reviewer_role,
      program_id,
      category,
      rating,
      review_text,
      skills
    } = req.body;
    
    console.log('Received review data:', req.body);
    
    // Validation
    if (!reviewer_name || !category || !rating || !review_text) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'reviewer_name, category, rating, and review_text are required'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Invalid rating',
        message: 'Rating must be between 1 and 5'
      });
    }
    
    const insertQuery = `
      INSERT INTO reviews (
        reviewer_name, reviewer_role, program_id, category, rating, 
        review_text, skills, avatar, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    // Safe JSON stringification for skills
    let skillsJson = null;
    if (skills && Array.isArray(skills) && skills.length > 0) {
      try {
        skillsJson = JSON.stringify(skills);
      } catch (error) {
        console.log('Error stringifying skills:', error);
        skillsJson = null;
      }
    }
    
    const avatarInitials = generateInitials(reviewer_name);
    
    const result = await queryWithRetry(insertQuery, [
      reviewer_name,
      reviewer_role || '',
      program_id || null,
      category,
      rating,
      review_text,
      skillsJson,
      avatarInitials
    ], 3, 15000);
    
    console.log('Review added successfully with ID:', result.insertId);
    
    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      reviewId: result.insertId
    });
    
  } catch (error) {
    console.error('Error adding review:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: 'Unable to add review. Please try again later.',
      details: error.message
    });
  }
});

// GET /api/reviews/stats - Get review statistics
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating
      FROM reviews
    `;
    
    const categoryStatsQuery = `
      SELECT 
        category,
        COUNT(*) as count,
        AVG(rating) as avg_rating
      FROM reviews 
      GROUP BY category
    `;
    
    const [generalStats, categoryStats] = await Promise.all([
      queryWithRetry(statsQuery, [], 3, 10000),
      queryWithRetry(categoryStatsQuery, [], 3, 10000)
    ]);
    
    res.json({
      totalReviews: generalStats[0]?.total_reviews || 0,
      averageRating: parseFloat(generalStats[0]?.average_rating || 5.0).toFixed(1),
      totalStudents: 580, // Static value as specified
      categoryStats: categoryStats.reduce((acc, stat) => {
        acc[stat.category] = {
          count: stat.count,
          avgRating: parseFloat(stat.avg_rating).toFixed(1)
        };
        return acc;
      }, {})
    });
    
  } catch (error) {
    console.error('Error fetching review stats:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: 'Unable to fetch statistics. Please try again later.',
      details: error.message
    });
  }
});

// PUT /api/reviews/:id - Update a review
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reviewer_name,
      reviewer_role,
      program_id,
      category,
      rating,
      review_text,
      skills
    } = req.body;
    
    // Validation
    if (!reviewer_name || !category || !rating || !review_text) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'reviewer_name, category, rating, and review_text are required'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Invalid rating',
        message: 'Rating must be between 1 and 5'
      });
    }
    
    const updateQuery = `
      UPDATE reviews SET 
        reviewer_name = ?, reviewer_role = ?, program_id = ?, 
        category = ?, rating = ?, review_text = ?, skills = ?, 
        updated_at = NOW()
      WHERE id = ?
    `;
    
    // Safe JSON stringification for skills
    let skillsJson = null;
    if (skills && Array.isArray(skills) && skills.length > 0) {
      try {
        skillsJson = JSON.stringify(skills);
      } catch (error) {
        console.log('Error stringifying skills:', error);
        skillsJson = null;
      }
    }
    
    const result = await queryWithRetry(updateQuery, [
      reviewer_name,
      reviewer_role || '',
      program_id || null,
      category,
      rating,
      review_text,
      skillsJson,
      id
    ], 3, 15000);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Review not found',
        message: 'No review found with the provided ID'
      });
    }
    
    console.log('Review updated successfully, ID:', id);
    
    res.json({
      success: true,
      message: 'Review updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating review:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: 'Unable to update review. Please try again later.',
      details: error.message
    });
  }
});

// DELETE /api/reviews/:id - Delete a review
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleteQuery = 'DELETE FROM reviews WHERE id = ?';
    const result = await queryWithRetry(deleteQuery, [id], 3, 10000);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Review not found',
        message: 'No review found with the provided ID'
      });
    }
    
    console.log('Review deleted successfully, ID:', id);
    
    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting review:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: 'Unable to delete review. Please try again later.',
      details: error.message
    });
  }
});

// GET /api/reviews/category/:category - Get reviews by specific category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    console.log(`Fetching ${category} reviews from database...`);
    
    const query = `
      SELECT r.*, p.program_name 
      FROM reviews r 
      LEFT JOIN programs p ON r.program_id = p.id 
      WHERE r.category = ? 
      ORDER BY r.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const reviews = await queryWithRetry(query, [
      category, 
      parseInt(limit), 
      parseInt(offset)
    ], 3, 15000);
    
    const processedReviews = reviews.map(review => {
      // Safe JSON parsing for skills
      let parsedSkills = [];
      if (review.skills) {
        try {
          if (typeof review.skills === 'string') {
            parsedSkills = JSON.parse(review.skills);
          } else if (Array.isArray(review.skills)) {
            parsedSkills = review.skills;
          }
          
          if (!Array.isArray(parsedSkills)) {
            parsedSkills = [];
          }
        } catch (jsonError) {
          console.log(`Invalid JSON in skills for review ${review.id}`);
          parsedSkills = [];
        }
      }
      
      return {
        id: review.id,
        name: review.reviewer_name,
        role: review.reviewer_role || '',
        program: review.program_name || '',
        rating: review.rating,
        date: formatDate(review.created_at),
        review: review.review_text,
        avatar: review.avatar || generateInitials(review.reviewer_name),
        skills: parsedSkills
      };
    });
    
    console.log(`${category} reviews fetched successfully: ${processedReviews.length} reviews`);
    res.json(processedReviews);
    
  } catch (error) {
    console.error('Error fetching category reviews:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: 'Unable to fetch category reviews. Please try again later.',
      details: error.message
    });
  }
});

// Helper function to format date
function formatDate(date) {
  if (!date) return 'Unknown Date';
  
  try {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
  } catch (error) {
    console.log('Date formatting error:', error);
    return 'Invalid Date';
  }
}

// Helper function to generate initials from name
function generateInitials(name) {
  if (!name || typeof name !== 'string') return 'NA';
  
  try {
    return name
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  } catch (error) {
    console.log('Initials generation error:', error);
    return 'NA';
  }
}

export default router;