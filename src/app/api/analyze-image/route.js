import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const requestData = await request.json();
    const { imageBase64 } = requestData;
    
    console.log("API received image analysis request");

    if (!imageBase64) {
      console.error("No image provided in request");
      return NextResponse.json(
        { error: "No image provided", allDetected: [] },
        { status: 400 }
      );
    }
    
    // Check if the image is too large (rough estimate based on base64 string length)
    // Base64 encoding increases size by ~33%, so 8MB file becomes ~10.7MB string
    const MAX_BASE64_LENGTH = 11 * 1024 * 1024; // ~11MB
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      console.error(`Image too large: ${Math.round(imageBase64.length / (1024 * 1024))}MB base64 data`);
      return NextResponse.json(
        { error: "Image too large. Please use a smaller image or try again with a different photo.", allDetected: [] },
        { status: 413 }
      );
    }

    // First try with Groq API (primary)
    let ingredients = [];
    let success = false;
    
    // Check if Groq API key is available
    if (process.env.GROQ_API_KEY) {
      try {
        console.log("Attempting to analyze image with Groq API");
        ingredients = await analyzeWithGroq(imageBase64);
        success = true;
        console.log("Successfully analyzed image with Groq API");
      } catch (groqError) {
        console.error("Error with Groq API:", groqError.message);
        // Continue to fallback
      }
    } else {
      console.warn("Groq API key not configured");
    }
    
    // Fallback to Claude if Groq failed
    if (!success && process.env.CLAUDE_API_KEY) {
      try {
        console.log("Attempting to analyze image with Claude API");
        ingredients = await analyzeWithClaude(imageBase64);
        success = true;
        console.log("Successfully analyzed image with Claude API");
      } catch (claudeError) {
        console.error("Error with Claude API:", claudeError.message);
      }
    } else if (!success) {
      console.warn("Claude API key not configured for fallback");
    }
    
    if (!success) {
      console.error("All API attempts failed");
      return NextResponse.json(
        { error: "Failed to analyze image with available APIs", allDetected: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      allDetected: ingredients
    });
  } catch (error) {
    // Log detailed error information
    console.error("Error analyzing image:", error);
    
    // Check for specific error types
    let errorMessage = "Failed to analyze image";
    let statusCode = 500;
    
    if (error.message && error.message.includes("too large")) {
      errorMessage = "Image too large. Please use a smaller image.";
      statusCode = 413;
    } else if (error.message && error.message.includes("timeout")) {
      errorMessage = "Analysis timed out. Please try again with a simpler image.";
      statusCode = 408;
    } else if (error.message && error.message.includes("parse")) {
      errorMessage = "Failed to process image data. Please try a different format.";
      statusCode = 422;
    }
    
    return NextResponse.json(
      { error: errorMessage, allDetected: [] },
      { status: statusCode }
    );
  }
}

async function analyzeWithGroq(imageBase64) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: "You are an expert at identifying cocktail ingredients, beverages, and food items from images. Your task is to identify specific ingredients, beverages, and brands that you can clearly see in the image. Be precise and accurate with your identifications."
        },
        {
          role: "user",
          content: `This is an image of ingredients and beverages that could be used for cocktails (base64 encoded): ${imageBase64.substring(0, 100)}... [truncated].

Your task is to identify specific ingredients, beverages, and brands that you can clearly see in the image.

RULES TO FOLLOW:
1. List ONLY items that are CLEARLY VISIBLE in the image
2. Include full brand names when possible (e.g., 'Bombay Sapphire Gin', 'Absolut Vodka', 'Fever-Tree Tonic Water')
3. For alcoholic beverages: Identify bottles with their complete brand names and types
4. For non-alcoholic beverages: Identify with brand names when visible (e.g., 'Coca-Cola', 'Schweppes Ginger Ale')
5. For fresh ingredients: Be specific (e.g., 'Fresh lime', 'Maraschino cherries', 'Angostura bitters')
6. DO NOT guess or hallucinate brands that aren't clearly visible
7. If you're uncertain about a brand but can see the type of spirit/beverage, just list the generic type
8. Format your response as a simple comma-separated list

EXAMPLES OF GOOD RESPONSES:
- "Tito's Vodka, lime, simple syrup, ice"
- "Hendrick's Gin, Fever-Tree Tonic Water, cucumber"
- "lemons, limes, oranges, sugar"
- "Jack Daniel's Whiskey, Coca-Cola, ice cubes"

DO NOT include explanations, observations, or anything other than the ingredient list.`
        }
      ],
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Groq API error:", errorData);
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  console.log("Groq API response content:", content);

  // Parse the ingredients from the response
  return parseIngredientsFromResponse(content);
}

async function analyzeWithClaude(imageBase64) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3.7-sonnet-20240229",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your task is to identify specific ingredients, beverages, and brands that you can clearly see in the image. This is for a cocktail recipe app, so accuracy is critical.

RULES TO FOLLOW:
1. List ONLY items that are CLEARLY VISIBLE in the image
2. Include full brand names when possible (e.g., 'Bombay Sapphire Gin', 'Absolut Vodka', 'Fever-Tree Tonic Water')
3. For alcoholic beverages: Identify bottles with their complete brand names and types
4. For non-alcoholic beverages: Identify with brand names when visible (e.g., 'Coca-Cola', 'Schweppes Ginger Ale')
5. For fresh ingredients: Be specific (e.g., 'Fresh lime', 'Maraschino cherries', 'Angostura bitters')
6. DO NOT guess or hallucinate brands that aren't clearly visible
7. If you're uncertain about a brand but can see the type of spirit/beverage, just list the generic type
8. Format your response as a simple comma-separated list

EXAMPLES OF GOOD RESPONSES:
- "Tito's Vodka, lime, simple syrup, ice"
- "Hendrick's Gin, Fever-Tree Tonic Water, cucumber"
- "lemons, limes, oranges, sugar"
- "Jack Daniel's Whiskey, Coca-Cola, ice cubes"

DO NOT include explanations, observations, or anything other than the ingredient list.`
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Claude API error:", errorData);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Check if the response has the expected structure
  if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
    console.error("Unexpected Claude API response structure:", JSON.stringify(data));
    return [];
  }
  
  // Safely access the text property
  const content = data.content[0]?.text || "";
  console.log("Claude API response content:", content);

  // Parse the ingredients from the response
  return parseIngredientsFromResponse(content);
}

function parseIngredientsFromResponse(content) {
  let ingredients = [];
  try {
    // Try to parse as JSON if it looks like JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      ingredients = JSON.parse(jsonMatch[0]);
    } else {
      // First, clean up the content by removing any explanatory text
      // Claude sometimes adds explanations despite instructions not to
      let cleanedContent = content;
      
      // Remove any text before a list if it exists
      const listMarkers = ['ingredients:', 'ingredients i can see:', 'visible ingredients:', 'i can see:'];
      for (const marker of listMarkers) {
        const markerIndex = cleanedContent.toLowerCase().indexOf(marker);
        if (markerIndex !== -1) {
          cleanedContent = cleanedContent.substring(markerIndex + marker.length);
          break;
        }
      }
      
      // Split by commas or newlines
      ingredients = cleanedContent
        .split(/,|\n/)
        .map((item) => item.trim())
        .filter((item) => {
          // Only keep actual ingredients, filter out AI responses and sentences
          return item.length > 0 && 
            // Filter out common AI responses and explanatory text
            !item.toLowerCase().includes("i don't see") &&
            !item.toLowerCase().includes("cannot identify") &&
            !item.toLowerCase().includes("i can help") &&
            !item.toLowerCase().includes("i can see") &&
            !item.toLowerCase().includes("here are") &&
            !item.toLowerCase().includes("the ingredients") &&
            !item.toLowerCase().includes("please let me") &&
            !item.toLowerCase().includes("based on") &&
            !item.toLowerCase().includes("following ingredients") &&
            !item.toLowerCase().includes("let me know") &&
            !item.toLowerCase().includes("need more") &&
            !item.toLowerCase().includes("visible in the image") &&
            !item.toLowerCase().includes("that's all") &&
            !item.toLowerCase().includes("that i can") &&
            // Filter out sentences (more than 4 words) but allow longer brand names
            (item.split(/\s+/).length <= 4 || item.toLowerCase().includes("fever-tree") || 
             item.toLowerCase().includes("maker's mark") || item.toLowerCase().includes("bombay sapphire"));
        })
        .map((item) => {
          // Clean up any remaining formatting
          return item
            .replace(/^[\s\u2022\-\u2013\u2014*•]+|^[0-9]+\.?\s*/g, "") // Remove bullets, dashes, and numbering
            .replace(/\.$/, "") // Remove trailing periods
            .replace(/^"(.*)"$/, "$1") // Remove surrounding quotes if present
            .trim(); // Ensure no leading/trailing whitespace
        });
    }
    
    // Log the parsed ingredients
    console.log("Parsed ingredients:", ingredients);
    return ingredients;
  } catch (parseError) {
    console.error("Error parsing ingredients:", parseError);
    return [];
  }
}
