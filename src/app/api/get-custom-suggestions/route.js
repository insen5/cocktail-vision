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

    // Try to get suggestions from available AI providers
    try {
      // Try multiple providers with fallback mechanism
      const suggestions = await getCustomSuggestions(ingredients);
      console.log("Generated suggestions:", JSON.stringify(suggestions));
      return NextResponse.json({ suggestions });
    } catch (error) {
      console.error("All AI providers failed:", error);
      return NextResponse.json(
        { error: "Failed to generate custom suggestions", message: error.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

/**
 * Get custom cocktail suggestions based on ingredients
 * @param {Array} ingredients - List of ingredients
 * @returns {Promise<Array>} - List of cocktail suggestions
 */
async function getCustomSuggestions(ingredients) {
  // Try providers in sequence until one works
  const errors = [];
  
  // Try Groq first (generous free tier available)
  try {
    const suggestions = await getGroqSuggestions(ingredients);
    console.log("Successfully got suggestions from Groq");
    return suggestions;
  } catch (error) {
    console.warn("Groq API failed:", error.message);
    errors.push(`Groq: ${error.message}`);
  }
  
  // Try Claude second
  try {
    const suggestions = await getClaudeSuggestions(ingredients);
    console.log("Successfully got suggestions from Claude");
    return suggestions;
  } catch (error) {
    console.warn("Claude API failed:", error.message);
    errors.push(`Claude: ${error.message}`);
  }
  
  // If all APIs fail, throw a comprehensive error
  throw new Error(`All AI providers failed: ${errors.join('; ')}`);
}

/**
 * Get suggestions using Groq API
 * @param {Array} ingredients - List of ingredients
 * @returns {Promise<Array>} - List of cocktail suggestions
 */
async function getGroqSuggestions(ingredients) {
  // Check if API key is available
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Groq API key");
  }

  // Call Groq API to generate custom cocktail suggestions
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama3-8b-8192", // Using Llama 3 8B model which has a generous free tier
      messages: [
        {
          role: "system",
          content: `You are a professional bartender with extensive knowledge of cocktails and mixology. 
          Your task is to suggest creative cocktail recipes based on the ingredients provided.`
        },
        {
          role: "user",
          content: `I have these ingredients: ${ingredients.join(', ')}. 
          Suggest 3 cocktails I can make with some or all of these ingredients, plus maybe 1-2 common ingredients 
          that most people would have. For each cocktail, provide a name, ingredients with measurements, and brief 
          preparation instructions. Format your response as a JSON array with objects containing 'name', 'ingredients', 
          and 'instructions' fields.`
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq API error response:", errorText);
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("Groq API raw response:", JSON.stringify(data));
  const content = data.choices[0]?.message?.content || "";
  console.log("Groq content to parse:", content);
  return parseAIResponse(content);
}

/**
 * Get suggestions using Claude (Anthropic) API
 * @param {Array} ingredients - List of ingredients
 * @returns {Promise<Array>} - List of cocktail suggestions
 */
async function getClaudeSuggestions(ingredients) {
  // Check if API key is available
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Claude API key");
  }

  // Call Claude API to generate custom cocktail suggestions
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307", // Using the smallest/cheapest model
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `You are a professional bartender with extensive knowledge of cocktails and mixology.
          
          I have these ingredients: ${ingredients.join(', ')}. 
          
          Suggest 3 cocktails I can make with some or all of these ingredients, plus maybe 1-2 common ingredients 
          that most people would have. For each cocktail, provide a name, ingredients with measurements, and brief 
          preparation instructions. Format your response as a JSON array with objects containing 'name', 'ingredients', 
          and 'instructions' fields.`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Claude API error response:", errorText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("Claude API raw response:", JSON.stringify(data));
  const content = data.content[0]?.text || "";
  console.log("Claude content to parse:", content);
  return parseAIResponse(content);
}

/**
 * Parse AI response into structured cocktail data
 * @param {string} content - Raw AI response
 * @returns {Array} - Structured cocktail data
 */
function parseAIResponse(content) {
  try {
    // Try to parse as JSON directly
    const parsedData = JSON.parse(content);
    if (Array.isArray(parsedData)) {
      return parsedData.map((cocktail, index) => ({
        id: `custom-${index + 1}`,
        name: cocktail.name || "Unknown Cocktail",
        ingredients: cocktail.ingredients || [],
        instructions: cocktail.instructions || "",
        custom: true
      }));
    }
    
    // If we got a JSON object but not an array
    if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
      if (parsedData.cocktails && Array.isArray(parsedData.cocktails)) {
        return parsedData.cocktails.map((cocktail, index) => ({
          id: `custom-${index + 1}`,
          name: cocktail.name || "Unknown Cocktail",
          ingredients: cocktail.ingredients || [],
          instructions: cocktail.instructions || "",
          custom: true
        }));
      }
    }
    
    // If JSON parsing failed or structure is unexpected, try to extract using regex
    console.warn("Direct JSON parsing failed, falling back to regex extraction");
    throw new Error("Invalid JSON format");
  } catch (error) {
    console.warn("JSON parsing error:", error.message);
    
    // Fallback: Try to extract JSON array using regex
    const jsonArrayRegex = /\[\s*\{[\s\S]*\}\s*\]/g;
    const match = content.match(jsonArrayRegex);
    
    if (match && match[0]) {
      try {
        const extractedJson = JSON.parse(match[0]);
        return extractedJson.map((cocktail, index) => ({
          id: `custom-${index + 1}`,
          name: cocktail.name || "Unknown Cocktail",
          ingredients: cocktail.ingredients || [],
          instructions: cocktail.instructions || "",
          custom: true
        }));
      } catch (e) {
        console.error("Regex extraction failed:", e.message);
      }
    }
    
    // If still no JSON, try the old regex approach for non-JSON formatted responses
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
        ingredients: ingredients,
        instructions: instructions,
        custom: true
      });
  });

    // Last resort: Return a default response if all parsing methods fail
    if (cocktails.length === 0) {
      console.error("All parsing methods failed, returning default response");
      return [
        {
          id: "custom-default",
          name: "Default Cocktail",
          ingredients: ["Use the ingredients you have available"],
          instructions: "Mix all ingredients together. We couldn't parse the AI response properly.",
          custom: true
        }
      ];
    }
    
    return cocktails;
  }
}
