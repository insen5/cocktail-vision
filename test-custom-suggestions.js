// Simple test script to view custom suggestions UI
// Run this with: node test-custom-suggestions.js

// Sample custom suggestions data that mimics API response
const sampleCustomSuggestions = [
  {
    id: "custom-1",
    name: "Gin Basil Smash",
    ingredients: [
      "2 oz Gin",
      "1 oz Fresh lemon juice",
      "3/4 oz Simple syrup",
      "8-10 Fresh basil leaves"
    ],
    instructions: "Muddle basil leaves with simple syrup in a shaker. Add gin, lemon juice, and ice. Shake vigorously and double strain into a rocks glass filled with ice. Garnish with a basil leaf.",
    custom: true
  },
  {
    id: "custom-2",
    name: "Spicy Margarita",
    ingredients: [
      { name: "Tequila", amount: 2, unit: "oz" },
      { name: "Lime juice", amount: 1, unit: "oz" },
      { name: "Agave syrup", amount: 0.5, unit: "oz" },
      { name: "Jalapeño slices", amount: 2, unit: "" }
    ],
    instructions: "Muddle jalapeño slices with agave syrup in a shaker. Add tequila, lime juice, and ice. Shake well and strain into a salt-rimmed glass filled with ice. Garnish with a lime wheel and jalapeño slice.",
    custom: true
  },
  {
    id: "custom-3",
    name: "Whiskey Sour",
    ingredients: [
      "2 oz Bourbon whiskey",
      "3/4 oz Fresh lemon juice",
      "1/2 oz Simple syrup",
      "1 Egg white (optional)",
      "Angostura bitters"
    ],
    instructions: "Add all ingredients to a shaker without ice and dry shake vigorously (if using egg white). Add ice and shake again until well-chilled. Strain into a rocks glass over fresh ice. Garnish with a dash of Angostura bitters and a lemon twist.",
    custom: true
  }
];

// Log the sample data in a format that shows how it would look
console.log("Sample Custom Suggestions:");
console.log(JSON.stringify(sampleCustomSuggestions, null, 2));

console.log("\nTo see this UI in action:");
console.log("1. Start the development server with 'npm run dev'");
console.log("2. Open the app in your browser");
console.log("3. Add some ingredients and click 'Find Cocktails'");
console.log("4. The custom suggestions should appear in the new card format");
console.log("\nAlternatively, you can modify the page.jsx file to temporarily hardcode these suggestions for testing:");
console.log("- Find the getRecommendations function");
console.log("- Add a line like: setCustomSuggestions(sampleCustomSuggestions);");
console.log("- This will show the custom suggestions without needing to call the API");
