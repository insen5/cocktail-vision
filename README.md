# Cocktail Vision

A web application that helps you discover cocktail recipes based on ingredients you have available. Simply upload a photo of your bar, fridge, or kitchen, and the app will identify ingredients and suggest cocktails you can make.

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
- **AI Integration**: OpenAI GPT-4 Vision for image analysis and GPT-4 for custom recipe generation
- **Deployment**: GitHub Pages

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- NPM or Yarn
- OpenAI API Key for AI features

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

3. Create a `.env.local` file in the root directory and add your OpenAI API key
   ```
   OPENAI_API_KEY=your_api_key_here
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
3. The GitHub Actions workflow will automatically build and deploy your site

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