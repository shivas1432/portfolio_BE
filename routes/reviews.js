import express from 'express';
import db from '../config/db.js'; // Adjust path according to your db config

const router = express.Router();

// GET /api/reviews - Get all reviews
router.get('/', async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;
    
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
    
    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    const reviews = await new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Group reviews by category for frontend
    const groupedReviews = {
      stack360: [],
      career360: [],
      core360: [],
      instagram: [],
      general: []
    };
    
    reviews.forEach(review => {
      const reviewData = {
        id: review.id,
        name: review.reviewer_name,
        role: review.reviewer_role,
        program: review.program_name,
        rating: review.rating,
        date: formatDate(review.created_at),
        review: review.review_text,
        avatar: review.avatar || generateInitials(review.reviewer_name),
        skills: review.skills ? JSON.parse(review.skills) : [],
        isInstagram: review.category === 'instagram',
        likes: review.likes || 0,
        comments: review.comments || 0
      };
      
      if (groupedReviews[review.category]) {
        groupedReviews[review.category].push(reviewData);
      }
    });
    
    res.json(groupedReviews);
    
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch reviews' 
    });
  }
});

// GET /api/reviews/stats - Get review statistics
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        (SELECT COUNT(*) FROM programs WHERE status = 'completed') as total_students
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
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    const categoryStats = await new Promise((resolve, reject) => {
      db.query(categoryStatsQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    res.json({
      totalReviews: generalStats.total_reviews,
      averageRating: parseFloat(generalStats.average_rating).toFixed(1),
      totalStudents: generalStats.total_students || 580,
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
      skills,
      likes,
      comments,
      avatar
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
    
    const insertQuery = `
      INSERT INTO reviews (
        reviewer_name, reviewer_role, program_id, category, rating, 
        review_text, skills, likes, comments, avatar, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const skillsJson = skills ? JSON.stringify(skills) : null;
    const avatarInitials = avatar || generateInitials(reviewer_name);
    
    const result = await new Promise((resolve, reject) => {
      db.query(insertQuery, [
        reviewer_name,
        reviewer_role,
        program_id,
        category,
        rating,
        review_text,
        skillsJson,
        likes || 0,
        comments || 0,
        avatarInitials
      ], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
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
      skills,
      likes,
      comments
    } = req.body;
    
    const updateQuery = `
      UPDATE reviews SET 
        reviewer_name = ?, reviewer_role = ?, program_id = ?, 
        category = ?, rating = ?, review_text = ?, skills = ?, 
        likes = ?, comments = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    const skillsJson = skills ? JSON.stringify(skills) : null;
    
    const result = await new Promise((resolve, reject) => {
      db.query(updateQuery, [
        reviewer_name,
        reviewer_role,
        program_id,
        category,
        rating,
        review_text,
        skillsJson,
        likes || 0,
        comments || 0,
        id
      ], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Review not found',
        message: 'No review found with the provided ID'
      });
    }
    
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

// DELETE /api/reviews/:id - Delete a review
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleteQuery = 'DELETE FROM reviews WHERE id = ?';
    const result = await new Promise((resolve, reject) => {
      db.query(deleteQuery, [id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Review not found',
        message: 'No review found with the provided ID'
      });
    }
    
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

// Helper function to format date
function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(date).toLocaleDateString('en-US', options);
}

// Helper function to generate initials from name
function generateInitials(name) {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
}

export default router;