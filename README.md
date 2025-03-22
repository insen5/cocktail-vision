# Cocktail Vision

A web application that helps you discover cocktail recipes based on ingredients you have available. Simply upload a photo of your bar, fridge, or kitchen, and the app will identify ingredients and suggest cocktails you can make. Perfect for home bartenders and cocktail enthusiasts!

> **Latest Update:** Enhanced API reliability with improved error handling and multi-provider fallback system.

## Features

- **Image Recognition**: Upload photos of your ingredients and let AI identify them
- **Manual Ingredient Entry**: Add ingredients manually if you prefer
- **Cocktail Recommendations**: Get suggestions for cocktails you can make with your ingredients
- **Custom Recipes**: Receive AI-generated custom cocktail recipes tailored to your available ingredients
- **Favorites**: Save your favorite cocktails for quick access
- **Responsive Design**: Works on mobile and desktop devices

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **State Management**: React Hooks with localStorage for persistence
- **AI Integration**: 
  - Groq API (primary) with Llama 3 8B model for custom recipe generation
  - Claude API (fallback) with Haiku model for custom recipe generation
  - Secure server-side API implementation for enhanced security
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- NPM or Yarn
- Groq API Key (primary) - Get one at https://console.groq.com/
- Claude API Key (fallback) - Get one at https://console.anthropic.com/

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/insen5/cocktail-vision.git
   cd cocktail-vision
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory and add your API keys
   ```
   GROQ_API_KEY=your_groq_api_key_here
   CLAUDE_API_KEY=your_claude_api_key_here
   ```

4. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

This project is configured for easy deployment to GitHub Pages:

1. Push your code to a GitHub repository
2. Add your OpenAI API key as a repository secret named `OPENAI_API_KEY`
3. Deploy using one of these methods:
   - The GitHub Actions workflow will automatically build and deploy your site
   - Or manually deploy using `npm run deploy`

### Live Demo

The application is deployed and available at: [https://insen5.github.io/cocktail-vision/](https://insen5.github.io/cocktail-vision/)

## Usage

1. **Add Ingredients**: Upload a photo of your ingredients or add them manually
2. **Get Recommendations**: Click "Get Recommendations" to see cocktails you can make
3. **View Recipes**: Browse through the recommended cocktails and their recipes
4. **Save Favorites**: Mark cocktails as favorites for quick access later

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Cocktail recipes sourced from various mixology resources
- OpenAI for providing the AI capabilities
- Next.js team for the amazing framework