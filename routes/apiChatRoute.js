import express from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const router = express.Router();

router.use(cors({ 
  origin: ['http://localhost:3000', 'https://shivashankerportfolio.netlify.app']
}));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again later.',
  handler: (req, res) => {
    console.warn(`Rate limit exceeded by IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

const portfolioContext = {
  name: "Shivashanker",
  role: "Full Stack Developer",
  website: "https://shivashankerportfolio.netlify.app/",
  skills: [
    "Frontend: React, JavaScript, HTML5, CSS3, Tailwind CSS",
    "Backend: Node.js, Express.js, Python, Django",
    "Database: MongoDB, MySQL, PostgreSQL",
    "Cloud: AWS, Netlify, Render",
    "Other: Git, REST APIs, Responsive Design, AI Integrations"
  ],
  projects: [
    {
      name: "Portfolio Website",
      description: "Personal portfolio website with AI assistance for visitors to showcase skills and projects",
      technologies: "React, Node.js, Express, Gemini API, Netlify",
      link: "https://shivashankerportfolio.netlify.app/"
    },
    {
      name: "Weather App",
      description: "Real-time weather application with location-based forecasts and interactive maps",
      technologies: "React, Weather API, JavaScript, CSS3",
      link: "https://shivashankerportfolio.netlify.app/weather"
    },
    {
      name: "News Aggregator",
      description: "Personalized news platform that collects and categorizes articles from various sources",
      technologies: "React, Node.js, News API, MongoDB",
      link: "https://shivashankerportfolio.netlify.app/news"
    },
    {
      name: "Blog Platform",
      description: "Content management system for creating and publishing blog posts with user authentication",
      technologies: "React, Express, MongoDB, JWT Authentication",
      link: "https://shivashankerportfolio.netlify.app/blogs"
    }
  ],
  experience: [
    {
      position: "Full Stack Developer",
      company: "Tech Solutions Inc.",
      duration: "2022-Present",
      responsibilities: "Developing and maintaining web applications using React and Node.js, implementing responsive designs, integrating third-party APIs"
    },
    {
      position: "Frontend Developer",
      company: "Web Innovations",
      duration: "2020-2022",
      responsibilities: "Creating interactive user interfaces, optimizing website performance, collaborating with design teams"
    }
  ],
  education: [
    {
      degree: "Bachelor of Technology in Computer Science",
      institution: "Technical University",
      year: "2020"
    }
  ],
  aiFeatures: "The portfolio includes an AI assistant powered by Google's Gemini API that helps visitors learn about Shivashanker's skills, projects, and experience. The AI is context-aware and can provide detailed information about the portfolio's content.",
  contactInfo: "For professional inquiries, please visit the contact page at https://shivashankerportfolio.netlify.app/contact"
};

const callGeminiWithRetry = async (message, isPortfolioQuestion = false, retries = 3) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is missing');
  }
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  
  let enhancedMessage = message;
  if (isPortfolioQuestion && !message.includes("You are an AI assistant for Shivashanker's portfolio")) {
    enhancedMessage = `
      You are an AI assistant for Shivashanker's portfolio website.
      
      DETAILED PORTFOLIO INFORMATION:
      
      ABOUT SHIVASHANKER:
      Name: ${portfolioContext.name}
      Role: ${portfolioContext.role}
      
      SKILLS:
      ${portfolioContext.skills.join("\n")}
      
      PROJECTS:
      ${portfolioContext.projects.map(project => 
        `- ${project.name}: ${project.description}\n  Technologies: ${project.technologies}\n  Link: ${project.link}`
      ).join("\n\n")}
      
      PROFESSIONAL EXPERIENCE:
      ${portfolioContext.experience.map(exp => 
        `- ${exp.position} at ${exp.company} (${exp.duration})\n  ${exp.responsibilities}`
      ).join("\n\n")}
      
      EDUCATION:
      ${portfolioContext.education.map(edu => 
        `- ${edu.degree} from ${edu.institution} (${edu.year})`
      ).join("\n\n")}
      
      AI FEATURES IN PORTFOLIO:
      ${portfolioContext.aiFeatures}
      
      CONTACT INFORMATION:
      ${portfolioContext.contactInfo}
      
      WEBSITE:
      ${portfolioContext.website}
      
      INSTRUCTIONS:
      1. ALWAYS provide detailed information from the portfolio context above instead of just redirecting to the website
      2. Only include the website link as additional information, not as the sole response
      3. Answer questions directly using the information provided
      4. Be detailed in your responses about projects, skills, and experience
      5. For general greetings, respond in a friendly and professional manner
      6. Use markdown formatting to make your responses more readable when appropriate
      
      User's question: ${message}
      
      Respond in a helpful, professional tone with SPECIFIC DETAILS from the portfolio information above.
    `;
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(apiUrl, {
        contents: [
          {
            parts: [{ text: enhancedMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1500,
        }
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
          
          return postProcessResponse(generatedText);
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

const postProcessResponse = (response) => {
  if (response.includes(portfolioContext.website) && 
      (response.length < 200 || response.toLowerCase().includes("visit the website for more"))) {
    
    if (response.toLowerCase().includes("recent projects")) {
      const projectInfo = portfolioContext.projects.map(project => 
        `- **${project.name}**: ${project.description} (Technologies: ${project.technologies})`
      ).join("\n\n");
      
      return `Here are Shivashanker's recent projects:\n\n${projectInfo}\n\nYou can view these projects in more detail at ${portfolioContext.website}`;
    }
    
    if (response.toLowerCase().includes("tech stack") || response.toLowerCase().includes("skills")) {
      return `Shivashanker specializes in the following technologies:\n\n${portfolioContext.skills.join("\n")}\n\nFor more details about his skills, you can visit ${portfolioContext.website}`;
    }
    
    if (response.toLowerCase().includes("ai") || response.toLowerCase().includes("assistance")) {
      return `${portfolioContext.aiFeatures}\n\nYou can experience this AI assistant directly at ${portfolioContext.website}`;
    }
    
    return `${response}\n\nShivashanker's portfolio showcases his skills including ${portfolioContext.skills.slice(0, 3).join(", ")} and projects like ${portfolioContext.projects.map(p => p.name).join(", ")}. You can explore more at ${portfolioContext.website}`;
  }
  
  return response;
};

router.post('/', apiLimiter, async (req, res) => {
  const { message, isPortfolioQuestion = false } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid message input' });
  }
  
  try {
    const chatResponse = await callGeminiWithRetry(message, isPortfolioQuestion);
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