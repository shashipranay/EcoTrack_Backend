# Footprint Wise Eco - Backend

A comprehensive backend API for the Footprint Wise Eco carbon footprint tracking application, built with Node.js, Express, MongoDB, and integrated with Google's Gemini AI for intelligent insights.

## 🚀 Features

- **User Authentication & Authorization**: JWT-based secure authentication
- **Carbon Footprint Tracking**: Comprehensive activity logging and calculation
- **Goal Management**: Set and track sustainability goals with progress monitoring
- **Achievement System**: Gamified achievements and milestones
- **AI-Powered Insights**: Gemini AI integration for personalized recommendations
- **Real-time Analytics**: Detailed statistics and progress tracking
- **RESTful API**: Clean, well-documented API endpoints

## 🛠️ Tech Stack

- **Runtime**: Node.js with ES6 modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **AI Integration**: Google Gemini AI
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting
- **Development**: Nodemon for hot reloading

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB database
- Google Gemini API key

## 🔧 Installation

1. **Clone the repository and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   GEMINI_API_KEY=your_gemini_api_key
   CORS_ORIGIN=http://localhost:8080
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🗄️ Database Models

### User
- Profile information and preferences
- Carbon footprint tracking data
- Authentication details

### Activity
- Carbon footprint activities
- Categorized tracking (transportation, energy, food, etc.)
- Location and metadata support

### Goal
- Sustainability goals and targets
- Progress tracking and milestones
- Time-based objectives

### Achievement
- Gamified achievements system
- Progress-based unlocking
- Points and rarity system

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/stats` - Get user statistics
- `PUT /api/users/preferences` - Update preferences
- `DELETE /api/users/account` - Deactivate account

### Activities
- `POST /api/activities` - Create activity
- `GET /api/activities` - Get user activities
- `GET /api/activities/:id` - Get specific activity
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Delete activity
- `GET /api/activities/stats` - Get activity statistics

### Goals
- `POST /api/goals` - Create goal
- `GET /api/goals` - Get user goals
- `GET /api/goals/:id` - Get specific goal
- `PUT /api/goals/:id` - Update goal
- `PUT /api/goals/:id/progress` - Update goal progress
- `DELETE /api/goals/:id` - Delete goal
- `GET /api/goals/stats/overview` - Get goals statistics

### Achievements
- `GET /api/achievements` - Get user achievements
- `GET /api/achievements/unlocked` - Get unlocked achievements
- `GET /api/achievements/available` - Get available achievements
- `GET /api/achievements/:id` - Get specific achievement
- `POST /api/achievements/check` - Check achievement progress
- `GET /api/achievements/stats/overview` - Get achievements statistics

### Insights (AI-Powered)
- `GET /api/insights/overview` - Get AI insights overview
- `POST /api/insights/analyze` - Custom AI analysis
- `GET /api/insights/recommendations` - Personalized recommendations

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## 📊 Carbon Footprint Calculation

The system calculates carbon footprint based on:
- **Transportation**: Distance, vehicle type, fuel type
- **Energy**: Consumption, energy type
- **Food**: Food type, quantity, production method
- **Waste**: Weight, disposal method
- **Water**: Usage amount and treatment
- **Shopping**: Item type, production impact
- **Travel**: Distance, mode of transport

## 🤖 AI Integration

### Gemini AI Features
- **Personalized Insights**: Analysis of user's carbon footprint patterns
- **Custom Recommendations**: Tailored suggestions for reduction
- **Progress Analysis**: AI-powered progress tracking and insights
- **Educational Content**: Personalized learning recommendations

### AI Endpoints
- **Overview Insights**: Comprehensive analysis of user data
- **Custom Analysis**: Answer specific user questions
- **Recommendations**: Personalized action items

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Configure production MongoDB connection
3. Set secure JWT secret
4. Configure CORS for production domain
5. Set up proper logging and monitoring

### Environment Variables
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRE=7d
GEMINI_API_KEY=your-gemini-api-key
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔧 Development

### Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (to be implemented)

### Code Structure
```
backend/
├── models/          # Database models
├── routes/          # API route handlers
├── middleware/      # Custom middleware (to be added)
├── utils/           # Utility functions (to be added)
├── server.js        # Main server file
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Input Validation**: Express-validator for request validation
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Cross-origin resource sharing
- **Helmet**: Security headers
- **Data Sanitization**: Input sanitization and validation

## 📈 Performance

- **Database Indexing**: Optimized queries with proper indexes
- **Compression**: Response compression for faster loading
- **Rate Limiting**: Prevents API abuse
- **Efficient Aggregations**: MongoDB aggregation pipelines for statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Check the API documentation
- Review the error logs
- Ensure all environment variables are set correctly
- Verify MongoDB connection and Gemini API key

## 🔄 Updates

- **v1.0.0**: Initial release with core features
- Authentication and user management
- Carbon footprint tracking
- Goal and achievement systems
- AI-powered insights integration 