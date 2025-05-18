import express from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const router = express.Router();

router.use(cors({ 
  origin: ['http://localhost:3000', 'https://shivashanker.com']
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
  website: "https://shivashanker.com",
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
      link: "https://shivashanker.com"
    },
    {
      name: "Weather App",
      description: "Real-time weather application with location-based forecasts and interactive maps",
      technologies: "React, Weather API, JavaScript, CSS3",
      link: "https://shivashanker.com/weather"
    },
    {
      name: "News Aggregator",
      description: "Personalized news platform that collects and categorizes articles from various sources",
      technologies: "React, Node.js, News API, MongoDB",
      link: "https://shivashanker.com/news"
    },
    {
      name: "Blog Platform",
      description: "Content management system for creating and publishing blog posts with user authentication",
      technologies: "React, Express, MongoDB, JWT Authentication",
      link: "https://shivashanker.com/blogs"
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
  contactInfo: "For professional inquiries, please visit the contact page at https://shivashanker.com/contact"
};

const GREETING_RESPONSE = `Hi there! I'm Shivashanker's portfolio assistant. I can help answer questions about his skills, projects, and experience. How can I assist you today?`;

const NON_PORTFOLIO_RESPONSE = `I'm sorry, but I'm only designed to help with questions about Shivashanker's portfolio, skills, projects, and experience. I can't assist with other topics. Feel free to ask me anything about Shivashanker's work!`;

const detectGreeting = (message) => {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const normalizedMessage = message.trim().toLowerCase();
  
  if (normalizedMessage.length === 0) {
    return false;
  }

  const exactGreetings = [
    'hi', 'hey', 'hello', 'hai', 'hallo', 'hola', 'greetings', 
    'yo', 'sup', 'howdy', 'hei', 'hiya', 'heya'
  ];
  
  if (exactGreetings.some(greeting => normalizedMessage === greeting || normalizedMessage.startsWith(greeting + ' '))) {
    console.log(`Detected exact greeting match: "${normalizedMessage}"`);
    return true;
  }
  
  const greetingPhrases = [
    'how are you', 'how r u', 'how r you', 'how you doing',
    'how is it going', "how's it going", 'whats up', "what's up",
    'good morning', 'good afternoon', 'good evening', 'good day',
    'nice to meet', 'pleased to meet'
  ];
  
  if (greetingPhrases.some(phrase => normalizedMessage.includes(phrase))) {
    console.log(`Detected greeting phrase: "${normalizedMessage}" contains greeting pattern`);
    return true;
  }
  
  return false;
};

const isPortfolioRelated = (message) => {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const normalizedMessage = message.trim().toLowerCase();
  
  const portfolioKeywords = [
    'portfolio', 'project', 'skill', 'experience', 'resume', 'work', 'shivashanker', 'shiva', 
    'technology', 'tech stack', 'frontend', 'backend', 'database', 'react', 'node', 'javascript',
    'python', 'django', 'mongodb', 'mysql', 'postgresql', 'aws', 'netlify', 'render', 'git',
    'weather app', 'news aggregator', 'blog platform', 'education', 'contact', 'job', 'role',
    'developer', 'programming', 'code', 'web', 'website', 'app', 'application'
  ];
  
  return portfolioKeywords.some(keyword => normalizedMessage.includes(keyword));
};

const generatePortfolioPrompt = (userMessage) => {
  return `
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
    
    IMPORTANT RULES:
    1. ALWAYS provide specific information directly from the portfolio context above
    2. NEVER start your response with "visit the website" or similar phrases
    3. Respond first with detailed information and only mention the website at the end of your response
    4. Always include actual portfolio details (projects, skills, experience) in your response
    5. Only suggest visiting the website for more details after providing an informative answer
    6. For general greetings, respond in a friendly and professional manner
    7. IF THE QUERY IS NOT ABOUT SHIVASHANKER'S PORTFOLIO, SKILLS, PROJECTS, OR EXPERIENCE, respond with: "I'm sorry, but I'm only designed to help with questions about Shivashanker's portfolio, skills, projects, and experience. I can't assist with other topics. Feel free to ask me anything about Shivashanker's work!"
    8. Use markdown formatting to make your responses more readable when appropriate
    
    User's question: ${userMessage}
    
    Respond in a helpful, professional tone with SPECIFIC DETAILS from the portfolio information above. Do NOT just refer them to the website.
  `;
};

const callGeminiWithRetry = async (message, isPortfolioQuestion = false, retries = 3) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is missing');
  }
  
  if (detectGreeting(message)) {
    return GREETING_RESPONSE;
  }
  
  if (!isPortfolioRelated(message) && !message.includes("You are an AI assistant for Shivashanker's portfolio")) {
    return NON_PORTFOLIO_RESPONSE;
  }
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  
  let enhancedMessage = message;
  if (isPortfolioQuestion && !message.includes("You are an AI assistant for Shivashanker's portfolio")) {
    enhancedMessage = generatePortfolioPrompt(message);
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
  if (response.toLowerCase().includes("i'm sorry") && 
      (response.toLowerCase().includes("can't assist") || 
       response.toLowerCase().includes("cannot assist") || 
       response.toLowerCase().includes("only designed to help"))) {
    return NON_PORTFOLIO_RESPONSE;
  }
  
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
  
  if (response.includes(portfolioContext.website)) {
    const parts = response.split(portfolioContext.website);
    
    if (parts[0].trim().length < 50 || parts[0].toLowerCase().includes("visit") || parts[0].toLowerCase().includes("check")) {
      return `Based on Shivashanker's portfolio:\n\n${parts.join(portfolioContext.website)}`;
    }
    
    if (parts.length > 1 && parts[parts.length-1].trim().length < 50) {
      return `${parts[0]} ${portfolioContext.website}\n\nFeel free to ask more questions about Shivashanker's skills or projects!`;
    }
  }
  
  if (response.toLowerCase().includes("i don't have") || 
      response.toLowerCase().includes("i don't know") || 
      response.toLowerCase().includes("not specified")) {
    return `${response}\n\nHere's what I do know about Shivashanker:\n- He's a ${portfolioContext.role} with skills in ${portfolioContext.skills.slice(0, 3).join(", ")}\n- His projects include ${portfolioContext.projects.map(p => p.name).slice(0, 2).join(" and ")}\n\nFor more specific information, you can visit ${portfolioContext.website}`;
  }
  
  if (!response.includes(portfolioContext.website)) {
    return `${response}\n\nFor more information, visit Shivashanker's portfolio at ${portfolioContext.website}`;
  }
  
  return response;
};

router.post('/', apiLimiter, async (req, res) => {
  const { message, isPortfolioQuestion = false } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid message input' });
  }
  
  console.log(`Received message: "${message}"`);
  
  if (detectGreeting(message)) {
    console.log("Greeting detected, returning greeting response");
    return res.json({ response: GREETING_RESPONSE });
  }
  
  if (!isPortfolioRelated(message) && !message.includes("You are an AI assistant for Shivashanker's portfolio")) {
    console.log("Non-portfolio query detected, returning standard response");
    return res.json({ response: NON_PORTFOLIO_RESPONSE });
  }
  
  try {
    console.log("Portfolio-related query, calling Gemini API");
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