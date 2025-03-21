import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const requestData = await request.json();
    const ingredients = requestData.ingredients || [];
    
    console.log("Custom suggestions API received request with ingredients:", ingredients);

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: "Ingredients must be a non-empty array" },
        { status: 400 }
      );
    }

    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OpenAI API key");
      return NextResponse.json(
        { error: "API configuration error", suggestions: [] },
        { status: 500 }
      );
    }

    // Call OpenAI API to generate custom cocktail suggestions
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional bartender with expertise in creating custom cocktails. Create 2-3 unique cocktail recipes based on the available ingredients. Be creative but practical."
          },
          {
            role: "user",
            content: `I have these ingredients available: ${ingredients.join(", ")}. What cocktails can I make? Please provide detailed recipes with measurements and instructions.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the response to extract cocktail suggestions
    const cocktails = parseGptResponse(content);

    return NextResponse.json({ suggestions: cocktails });
  } catch (error) {
    console.error("Error generating custom suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate custom suggestions" },
      { status: 500 }
    );
  }
}

// Helper function to parse GPT response into structured cocktail data
function parseGptResponse(content) {
  const cocktails = [];
  const cocktailRegex = /(?:^|\n)#+\s*(.*?)(?:\n|$)/g;
  const cocktailMatches = [...content.matchAll(cocktailRegex)];

  cocktailMatches.forEach((match, index) => {
    const name = match[1].trim();
    const startIndex = match.index + match[0].length;
    const endIndex = index < cocktailMatches.length - 1 ? cocktailMatches[index + 1].index : content.length;
    const cocktailContent = content.substring(startIndex, endIndex).trim();

    // Extract ingredients
    const ingredientsMatch = cocktailContent.match(/(?:ingredients|you'll need):(.*?)(?:instructions|directions|method|preparation|steps)/is);
    const ingredients = ingredientsMatch 
      ? ingredientsMatch[1].split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.match(/^[-*•]/))
          .map(line => {
            const cleanedLine = line.replace(/^[-*•]\s*/, '');
            return cleanedLine;
          })
      : [];

    // Extract instructions
    const instructionsMatch = cocktailContent.match(/(?:instructions|directions|method|preparation|steps):(.*?)(?:\n\n|$)/is);
    const instructions = instructionsMatch ? instructionsMatch[1].trim() : cocktailContent;

    cocktails.push({
      id: `custom-${index + 1}`,
      name,
      description: `Custom cocktail using your ingredients`,
      instructions,
      ingredients: ingredients.map((ing, i) => ({
        id: `custom-ing-${i + 1}`,
        name: ing,
        amount: "",
        unit: "",
        category: "Custom"
      })),
      image: `https://source.unsplash.com/random/?cocktail,${name.replace(/\s+/g, '')}`,
      isCustom: true
    });
  });

  return cocktails;
}
