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

    // First try with Groq API
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
          content: "You are a helpful assistant that identifies cocktail ingredients from images. List only the ingredients you can see, separated by commas."
        },
        {
          role: "user",
          content: `This is an image of ingredients that could be used for cocktails (base64 encoded): ${imageBase64.substring(0, 100)}... [truncated]. Please identify all visible ingredients (fruits, liquors, mixers, garnishes, etc.) that could be used in cocktail making. List ONLY the names of the ingredients you can see, separated by commas. Be specific but concise (e.g., 'lime' not 'green citrus fruit'). If you see bottles, try to identify what type of alcohol or mixer they contain.`
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
      model: "claude-3-opus-20240229",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `This is an image of ingredients that could be used for cocktails (base64 encoded): ${imageBase64.substring(0, 100)}... [truncated]. Please identify all visible ingredients (fruits, liquors, mixers, garnishes, etc.) that could be used in cocktail making. List ONLY the names of the ingredients you can see, separated by commas. Be specific but concise (e.g., 'lime' not 'green citrus fruit'). If you see bottles, try to identify what type of alcohol or mixer they contain.`
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
  const content = data.content[0].text;
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
      // Otherwise split by commas or newlines
      ingredients = content
        .split(/,|\n/)
        .map((item) => item.trim())
        .filter(
          (item) =>
            item.length > 0 &&
            !item.toLowerCase().includes("i don't see") &&
            !item.toLowerCase().includes("cannot identify")
        )
        .map((item) => item.replace(/^[\s\u2022\-\u2013\u2014*]+|^[0-9]+\.?\s*/g, ""));
    }
    
    // Log the parsed ingredients
    console.log("Parsed ingredients:", ingredients);
    return ingredients;
  } catch (parseError) {
    console.error("Error parsing ingredients:", parseError);
    return [];
  }
}
