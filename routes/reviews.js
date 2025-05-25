import express from 'express';
import db from '../config/db.js';

const router = express.Router();

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
    
    // Remove the LIMIT and OFFSET - get all reviews
    query += ` ORDER BY r.created_at DESC`;
    
    const reviews = await new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    
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
          // Check if skills is already an object/array or a string
          if (typeof review.skills === 'string') {
            parsedSkills = JSON.parse(review.skills);
          } else if (Array.isArray(review.skills)) {
            parsedSkills = review.skills;
          } else {
            parsedSkills = [];
          }
          
          // Ensure it's an array
          if (!Array.isArray(parsedSkills)) {
            parsedSkills = [];
          }
        } catch (jsonError) {
          console.log(`Invalid JSON in skills for review ${review.id}: "${review.skills}"`);
          console.log('JSON Error:', jsonError.message);
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
    console.error('Error fetching reviews:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch reviews' 
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
    
    const result = await new Promise((resolve, reject) => {
      db.query(insertQuery, [
        reviewer_name,
        reviewer_role || '',
        program_id || null,
        category,
        rating,
        review_text,
        skillsJson,
        avatarInitials
      ], (err, results) => {
        if (err) {
          console.error('Database insert error:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    
    console.log('Review added successfully with ID:', result.insertId);
    
    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      reviewId: result.insertId
    });
    
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to add review' 
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
    
    const generalStats = await new Promise((resolve, reject) => {
      db.query(statsQuery, (err, results) => {
        if (err) {
          console.error('Stats query error:', err);
          reject(err);
        } else {
          resolve(results[0]);
        }
      });
    });
    
    const categoryStats = await new Promise((resolve, reject) => {
      db.query(categoryStatsQuery, (err, results) => {
        if (err) {
          console.error('Category stats query error:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    
    res.json({
      totalReviews: generalStats.total_reviews || 0,
      averageRating: parseFloat(generalStats.average_rating || 5.0).toFixed(1),
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
    console.error('Error fetching review stats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch review statistics' 
    });
  }
});

// PUT /api/reviews/:id - Update a review (optional admin function)
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
    
    const result = await new Promise((resolve, reject) => {
      db.query(updateQuery, [
        reviewer_name,
        reviewer_role || '',
        program_id || null,
        category,
        rating,
        review_text,
        skillsJson,
        id
      ], (err, results) => {
        if (err) {
          console.error('Database update error:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    
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
    console.error('Error updating review:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to update review' 
    });
  }
});

// DELETE /api/reviews/:id - Delete a review (admin function)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleteQuery = 'DELETE FROM reviews WHERE id = ?';
    const result = await new Promise((resolve, reject) => {
      db.query(deleteQuery, [id], (err, results) => {
        if (err) {
          console.error('Delete query error:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    
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
    console.error('Error deleting review:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to delete review' 
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
    
    const reviews = await new Promise((resolve, reject) => {
      db.query(query, [category, parseInt(limit), parseInt(offset)], (err, results) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    
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
    console.error('Error fetching category reviews:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch category reviews' 
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