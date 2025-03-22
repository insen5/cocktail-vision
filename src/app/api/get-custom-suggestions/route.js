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
  console.log("Starting to parse AI response:", content.substring(0, 100) + "...");
  
  // Initialize cocktails array
  let cocktails = [];
  
  // Method 1: Try to parse as JSON directly
  try {
    console.log("Attempting direct JSON parsing");
    const parsedData = JSON.parse(content);
    console.log("JSON parsed successfully, checking structure");
    
    // If we got an array directly
    if (Array.isArray(parsedData)) {
      console.log("Parsed data is an array with", parsedData.length, "items");
      cocktails = parsedData.map((cocktail, index) => ({
        id: `custom-${index + 1}`,
        name: cocktail.name || "Unknown Cocktail",
        ingredients: Array.isArray(cocktail.ingredients) ? cocktail.ingredients : [cocktail.ingredients],
        instructions: cocktail.instructions || "",
        custom: true
      }));
      console.log("Successfully mapped array data to cocktails");
      return cocktails;
    }
    
    // If we got a JSON object with a cocktails array
    if (parsedData && typeof parsedData === 'object') {
      if (parsedData.cocktails && Array.isArray(parsedData.cocktails)) {
        console.log("Found cocktails array in JSON object with", parsedData.cocktails.length, "items");
        cocktails = parsedData.cocktails.map((cocktail, index) => ({
          id: `custom-${index + 1}`,
          name: cocktail.name || "Unknown Cocktail",
          ingredients: Array.isArray(cocktail.ingredients) ? cocktail.ingredients : [cocktail.ingredients],
          instructions: cocktail.instructions || "",
          custom: true
        }));
        console.log("Successfully mapped nested cocktails array");
        return cocktails;
      }
      
      // If we have a single cocktail object
      if (parsedData.name && (parsedData.ingredients || parsedData.instructions)) {
        console.log("Found single cocktail object in JSON");
        cocktails = [{
          id: "custom-1",
          name: parsedData.name,
          ingredients: Array.isArray(parsedData.ingredients) ? parsedData.ingredients : [parsedData.ingredients],
          instructions: parsedData.instructions || "",
          custom: true
        }];
        console.log("Successfully created cocktail from single object");
        return cocktails;
      }
    }
    
    console.warn("JSON structure doesn't match expected format", JSON.stringify(parsedData).substring(0, 100) + "...");
  } catch (error) {
    console.warn("JSON parsing error:", error.message);
  }
  
  // Method 2: Try to extract JSON array using regex
  try {
    console.log("Attempting JSON extraction via regex");
    const jsonArrayRegex = /\[\s*\{[\s\S]*?\}\s*\]/g;
    const match = content.match(jsonArrayRegex);
    
    if (match && match[0]) {
      console.log("Found potential JSON array via regex");
      try {
        const extractedJson = JSON.parse(match[0]);
        console.log("Successfully parsed extracted JSON with", extractedJson.length, "items");
        cocktails = extractedJson.map((cocktail, index) => ({
          id: `custom-${index + 1}`,
          name: cocktail.name || "Unknown Cocktail",
          ingredients: Array.isArray(cocktail.ingredients) ? cocktail.ingredients : [cocktail.ingredients],
          instructions: cocktail.instructions || "",
          custom: true
        }));
        console.log("Successfully mapped regex-extracted JSON");
        return cocktails;
      } catch (e) {
        console.error("Regex JSON extraction failed:", e.message);
      }
    } else {
      console.log("No JSON array pattern found in content");
    }
  } catch (regexError) {
    console.warn("Regex extraction error:", regexError.message);
  }
  
  // Method 3: Try to parse markdown-style cocktail recipes
  try {
    console.log("Attempting markdown-style parsing");
    // Look for cocktail names with markdown headers or numbered lists
    const cocktailRegex = /(?:^|\n)(?:#+\s*|\d+\.\s*)(.*?)(?:\n|$)/g;
    const cocktailMatches = [...content.matchAll(cocktailRegex)];
    console.log("Found", cocktailMatches.length, "potential cocktail headers");

    cocktailMatches.forEach((match, index) => {
      const name = match[1].trim();
      if (!name || name.length < 3) return; // Skip very short names
      
      const startIndex = match.index + match[0].length;
      const endIndex = index < cocktailMatches.length - 1 ? cocktailMatches[index + 1].index : content.length;
      const cocktailContent = content.substring(startIndex, endIndex).trim();
      console.log(`Processing cocktail: ${name}, content length: ${cocktailContent.length} chars`);

      // Extract ingredients - look for ingredients section or list items
      let ingredients = [];
      const ingredientsSection = cocktailContent.match(/(?:ingredients|you'll need|you will need)\s*:?\s*(.*?)(?:(?:instructions|directions|method|preparation|steps)\s*:|$)/is);
      
      if (ingredientsSection && ingredientsSection[1]) {
        // Split by newlines and/or bullet points
        ingredients = ingredientsSection[1].split(/\n|\r/)
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => line.replace(/^[-*•⁃◦‣⦿⁌⁍⦾⦿⧆⧇⧈⧠]\s*/, '').trim())
          .filter(line => line.length > 0);
      } else {
        // Try to find bullet points or numbered lists anywhere in the content
        const bulletItems = [...cocktailContent.matchAll(/[-*•⁃◦‣⦿⁌⁍⦾⦿⧆⧇⧈⧠]\s*([^\n]+)/g)];
        const numberedItems = [...cocktailContent.matchAll(/\d+\.\s*([^\n]+)/g)];
        
        const allItems = [...bulletItems, ...numberedItems].map(m => m[1].trim());
        if (allItems.length > 0) {
          ingredients = allItems;
        }
      }
      
      console.log(`Found ${ingredients.length} ingredients for ${name}`);

      // Extract instructions
      let instructions = "";
      const instructionsMatch = cocktailContent.match(/(?:instructions|directions|method|preparation|steps)\s*:?\s*(.*?)(?:\n\n|$)/is);
      
      if (instructionsMatch && instructionsMatch[1]) {
        instructions = instructionsMatch[1].trim();
      } else {
        // If no explicit instructions section, use remaining content after removing ingredients
        instructions = cocktailContent;
        ingredients.forEach(ingredient => {
          instructions = instructions.replace(ingredient, "");
        });
        instructions = instructions.replace(/(?:ingredients|you'll need)\s*:?/i, "").trim();
      }
      
      // Only add if we have at least a name and some content
      if (name && (ingredients.length > 0 || instructions.length > 10)) {
        cocktails.push({
          id: `custom-${index + 1}`,
          name,
          ingredients: ingredients.length > 0 ? ingredients : ["Ingredients not clearly specified"],
          instructions: instructions || "Instructions not provided",
          custom: true
        });
        console.log(`Added cocktail: ${name} with ${ingredients.length} ingredients`);
      }
    });

    if (cocktails.length > 0) {
      console.log("Successfully parsed", cocktails.length, "cocktails using markdown approach");
      return cocktails;
    }
  } catch (markdownError) {
    console.error("Markdown parsing error:", markdownError);
  }
  
  // Method 4: Last resort - try to extract any cocktail-like information
  try {
    console.log("Attempting last-resort extraction");
    // Look for patterns like "Cocktail Name:" or "Cocktail Name -"
    const lastResortRegex = /([A-Z][\w\s'&]+)(?::|-)\s*([\s\S]*?)(?=(?:[A-Z][\w\s'&]+)(?::|-)|

|$)/g;
    const matches = [...content.matchAll(lastResortRegex)];
    
    if (matches.length > 0) {
      console.log("Found", matches.length, "potential cocktails in last resort parsing");
      matches.forEach((match, index) => {
        const name = match[1].trim();
        const details = match[2].trim();
        
        if (name && details && name.length > 3 && details.length > 10) {
          cocktails.push({
            id: `custom-${index + 1}`,
            name,
            ingredients: ["Extracted from text"],
            instructions: details,
            custom: true
          });
        }
      });
    }
    
    if (cocktails.length > 0) {
      console.log("Successfully extracted", cocktails.length, "cocktails using last resort method");
      return cocktails;
    }
  } catch (lastResortError) {
    console.error("Last resort parsing error:", lastResortError);
  }

  // If all methods fail, return default response
  console.error("All parsing methods failed, returning default response");
  console.error("Raw content that couldn't be parsed:", content);
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
