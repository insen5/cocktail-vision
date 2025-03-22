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

    // First try with Claude API (primary)
    let ingredients = [];
    let success = false;
    
    // Check if Claude API key is available
    if (process.env.CLAUDE_API_KEY) {
      try {
        console.log("Attempting to analyze image with Claude API");
        ingredients = await analyzeWithClaude(imageBase64);
        success = true;
        console.log("Successfully analyzed image with Claude API");
      } catch (claudeError) {
        console.error("Error with Claude API:", claudeError.message);
        // Continue to fallback
      }
    } else {
      console.warn("Claude API key not configured");
    }
    
    // Fallback to Groq if Claude failed
    if (!success && process.env.GROQ_API_KEY) {
      try {
        console.log("Attempting to analyze image with Groq API");
        ingredients = await analyzeWithGroq(imageBase64);
        success = true;
        console.log("Successfully analyzed image with Groq API");
      } catch (groqError) {
        console.error("Error with Groq API:", groqError.message);
      }
    } else if (!success) {
      console.warn("Groq API key not configured for fallback");
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
    console.error("Error analyzing image:", error);
    return NextResponse.json(
      { error: "Failed to analyze image", allDetected: [] },
      { status: 500 }
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
          content: "You are a helpful assistant that identifies cocktail ingredients from images. Your task is to identify specific ingredients and brands that you can confidently recognize in the image. Include brand names when possible and be reasonably confident in your identifications, but you can include ingredients that are partially visible or somewhat obscured. Do not include completely random ingredients with no visual basis. List ingredients separated by commas."
        },
        {
          role: "user",
          content: `This is an image of ingredients that could be used for cocktails (base64 encoded): ${imageBase64.substring(0, 100)}... [truncated]. Please identify specific ingredients and brands that you can confidently recognize in the image. Include full brand names when you can identify them (e.g., 'Bombay Sapphire Gin', 'Absolut Vodka'). For bar shelves, identify bottles with their brand names when possible. For kitchen/fridge items, identify food items with their brands when visible. You can include ingredients you're reasonably confident about, even if they're partially visible or somewhat obscured. DO NOT include completely random ingredients with no visual basis. Respond ONLY with a comma-separated list of ingredients.`
        }
      ],
      max_tokens: 300
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
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your task is to identify specific ingredients and brands that you can confidently recognize in the image. This is for a cocktail recipe app, so accuracy is important, but we want to include all relevant ingredients you can identify with reasonable confidence.

Rules to follow:
1. Include full brand names when you can identify them (e.g., 'Bombay Sapphire Gin', 'Absolut Vodka', 'Fever-Tree Tonic Water')
2. For bar shelves: Identify bottles with their brand names and types when possible
3. For kitchen/fridge: Identify food items with their brands when visible
4. Include descriptive details when relevant (e.g., 'Fresh lime', 'Maraschino cherries', 'Angostura bitters')
5. You can include ingredients you're reasonably confident about, even if they're partially visible or somewhat obscured
6. DO NOT include completely random ingredients or pure guesses with no visual basis
7. Respond ONLY with a comma-separated list of ingredients - no explanations or other text

Examples of good responses:
- "Tanqueray Gin, Fever-Tree Tonic Water, Fresh lime, Ice cubes"
- "Maker's Mark Bourbon, Angostura bitters, Sugar cubes, Luxardo Maraschino cherries"
- "Coca-Cola, Bacardi White Rum, Fresh mint leaves, Lime wedges"

Now, list the ingredients you can confidently identify in the image, separated by commas.`
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
