// Multi-provider AI client utilities for cocktail suggestions
// Supports Groq and Claude (Anthropic) with fallback mechanism

/**
 * Get custom cocktail suggestions based on ingredients
 * @param {Array} ingredients - List of ingredients
 * @returns {Promise<Array>} - List of cocktail suggestions
 */
export async function getCustomSuggestions(ingredients) {
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    throw new Error("Ingredients must be a non-empty array");
  }

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
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
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
          Your task is to suggest creative cocktail recipes based on the ingredients provided.
          Focus only on providing detailed recipes with ingredients, measurements, and instructions.
          Do not include any references to YouTube videos or tutorials.`
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
  return parseAIResponse(data.choices[0]?.message?.content || "");
}

/**
 * Get suggestions using Claude (Anthropic) API
 * @param {Array} ingredients - List of ingredients
 * @returns {Promise<Array>} - List of cocktail suggestions
 */
async function getClaudeSuggestions(ingredients) {
  // Check if API key is available
  const apiKey = process.env.NEXT_PUBLIC_CLAUDE_API_KEY;
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
          and 'instructions' fields.
          
          IMPORTANT: Focus only on providing detailed recipes. Do not include any references to YouTube videos or tutorials.`
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
  
  // Check if the response has the expected structure
  if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
    console.error("Unexpected Claude API response structure:", JSON.stringify(data));
    // Return a default response or throw an error
    return parseAIResponse("");
  }
  
  // Safely access the text property
  const text = data.content[0]?.text || "";
  return parseAIResponse(text);
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
      return parsedData.map(cocktail => {
        // Extract only the fields we need, explicitly excluding youtubeVideos
        return {
          name: cocktail.name || "Unknown Cocktail",
          ingredients: cocktail.ingredients || [],
          instructions: cocktail.instructions || ""
          // YouTube videos section removed
        };
      });
    }
    
    // If we got a JSON object but not an array
    if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
      if (parsedData.cocktails && Array.isArray(parsedData.cocktails)) {
        return parsedData.cocktails.map(cocktail => ({
          name: cocktail.name || "Unknown Cocktail",
          ingredients: cocktail.ingredients || [],
          instructions: cocktail.instructions || ""
          // YouTube videos section removed
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
        return extractedJson.map(cocktail => ({
          name: cocktail.name || "Unknown Cocktail",
          ingredients: cocktail.ingredients || [],
          instructions: cocktail.instructions || ""
        }));
      } catch (e) {
        console.error("Regex extraction failed:", e.message);
      }
    }
    
    // Last resort: Return a default response
    console.error("All parsing methods failed, returning default response");
    return [
      {
        name: "Default Cocktail",
        ingredients: ["Use the ingredients you have available"],
        instructions: "Mix all ingredients together. We couldn't parse the AI response properly."
      }
    ];
  }
}
