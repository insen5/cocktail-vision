import { NextResponse } from 'next/server';

// Helper function to convert oz to ml in ingredient strings
function convertOzToMl(text) {
  if (!text) return text;
  
  // Match patterns like "2 oz", "1.5oz", "1/2 oz", etc.
  return text.replace(/(\d+(?:\.\d+)?|\d+\/\d+)\s*oz\b/gi, (match, amount) => {
    // Convert to number
    let numOz;
    if (amount.includes('/')) {
      // Handle fractions like 1/2
      const parts = amount.split('/');
      numOz = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      numOz = parseFloat(amount);
    }
    
    // Convert oz to ml (1 oz ≈ 30 ml)
    const ml = Math.round(numOz * 30);
    return `${ml} ml`;
  });
}

// Format ingredient for display
function formatIngredient(ingredient) {
  if (typeof ingredient === 'string') {
    return convertOzToMl(ingredient);
  } else if (typeof ingredient === 'object' && ingredient !== null) {
    if (ingredient.name) {
      let amount = ingredient.amount || ingredient.measure || '';
      let unit = ingredient.unit || '';
      
      if (unit.toLowerCase().includes('oz')) {
        const ml = Math.round(parseFloat(amount) * 30);
        amount = ml;
        unit = 'ml';
      }
      
      return `${amount} ${unit} ${ingredient.name}`.trim();
    } else {
      return JSON.stringify(ingredient)
        .replace(/[{}"']/g, '')
        .replace(/,/g, ', ')
        .replace(/:/g, ': ');
    }
  }
  return String(ingredient);
}

// Format instructions for display
function formatInstructions(instructions) {
  if (!instructions) return ['Instructions not available'];
  
  let cleanInstructions = typeof instructions === 'string' 
    ? instructions
        .replace(/\\n|\n/g, ' ')
        .replace(/\\r|\r/g, '')
        .replace(/\\t|\t/g, ' ')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/"instructions":|instructions:|\[|\]|Up"/gi, '')
        .replace(/\{|\}/g, '')
        .replace(/^\s*"|\"\s*$/g, '')
        .replace(/,$/g, '')
        .replace(/```/g, '')
        .replace(/Instructions:|Method:|Preparation:|Steps:/gi, '')
        .replace(/"|'/g, '')
        .trim()
    : 'Instructions not available';
  
  let steps = [];
  
  if (cleanInstructions.match(/\d+\s*\.|Step\s*\d+/i)) {
    steps = cleanInstructions.split(/(?=\d+\s*\.|Step\s*\d+)/i);
  } else if (cleanInstructions.includes('.')) {
    steps = cleanInstructions.split(/\.\s+/);
    steps = steps.filter(step => step.trim()).map(step => step.trim() + '.');
  } else {
    steps = [cleanInstructions];
  }
  
  return steps.map(step => step.replace(/^\d+\s*\.\s*|^Step\s*\d+:\s*/i, '').trim()).filter(Boolean);
}

// Helper function to parse GPT response into structured cocktail data
function parseGptResponse(content) {
  console.log("Parsing response content:", content.substring(0, 200) + "...");
  
  // If no content, return empty array
  if (!content || content.trim() === '') {
    console.warn("Empty content received");
    return [];
  }
  
  const cocktails = [];
  
  // Try to parse as JSON first in case it's already structured
  try {
    if (content.includes('{') && content.includes('}')) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        if (jsonData.cocktails && Array.isArray(jsonData.cocktails)) {
          return jsonData.cocktails.map((cocktail, index) => ({
            id: `custom-${index + 1}`,
            name: cocktail.name,
            formattedIngredients: Array.isArray(cocktail.ingredients) 
              ? cocktail.ingredients.map(ing => formatIngredient(ing))
              : [],
            formattedInstructions: Array.isArray(cocktail.instructions)
              ? cocktail.instructions.map(step => step.trim())
              : formatInstructions(cocktail.instructions),
            image: `https://source.unsplash.com/random/?cocktail,${cocktail.name.replace(/\s+/g, '')}`
          }));
        }
      }
    }
  } catch (e) {
    console.log("Not a valid JSON response, continuing with text parsing");
  }
  
  // Fallback to regex parsing for markdown/text format
  // First try to find cocktail names with markdown headers
  const cocktailRegex = /(?:^|\n)#+\s*(.*?)(?:\n|$)/g;
  let cocktailMatches = [...content.matchAll(cocktailRegex)];
  
  // If no markdown headers found, try to find cocktail names with numbered lists or other patterns
  if (cocktailMatches.length === 0) {
    const altRegex = /(?:^|\n)(?:\d+\.\s*|\*\s*|\-\s*)(\w[\w\s]+)(?:\n|$)/g;
    cocktailMatches = [...content.matchAll(altRegex)];
  }
  
  // If still no matches, try to split by double newlines and use first line of each section as title
  if (cocktailMatches.length === 0) {
    const sections = content.split(/\n\s*\n/);
    cocktailMatches = sections.map((section, i) => {
      const firstLine = section.split('\n')[0].trim();
      return {
        [1]: firstLine,
        index: content.indexOf(section)
      };
    });
  }

  // Process each cocktail section
  cocktailMatches.forEach((match, index) => {
    const name = match[1].trim();
    if (!name || name.length < 2) return; // Skip if name is too short
    
    const startIndex = match.index + match[0].length;
    const endIndex = index < cocktailMatches.length - 1 ? cocktailMatches[index + 1].index : content.length;
    const cocktailContent = content.substring(startIndex, endIndex).trim();

    // Extract ingredients - try multiple patterns
    let ingredientsMatch = cocktailContent.match(/(?:ingredients|you'll need):(.*?)(?:instructions|directions|method|preparation|steps)/is);
    if (!ingredientsMatch) {
      ingredientsMatch = cocktailContent.match(/(?:ingredients|you'll need)[^\n]*((?:\n[-*•].*)+)/i);
    }
    
    let rawIngredients = [];
    if (ingredientsMatch) {
      rawIngredients = ingredientsMatch[1].split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^[-*•]$/))
        .map(line => line.replace(/^[-*•]\s*/, ''));
    } else {
      // Try to find bullet points or numbered lists
      const bulletMatches = cocktailContent.match(/(?:^|\n)[-*•]\s*(.*?)(?:\n|$)/g);
      if (bulletMatches) {
        rawIngredients = bulletMatches.map(line => 
          line.replace(/^[-*•]\s*/, '').trim()
        );
      }
    }
    
    // Format ingredients
    const formattedIngredients = rawIngredients.map(ing => formatIngredient(ing));

    // Extract instructions
    let instructionsMatch = cocktailContent.match(/(?:instructions|directions|method|preparation|steps):(.*?)(?:\n\n|$)/is);
    if (!instructionsMatch) {
      instructionsMatch = cocktailContent.match(/(?:instructions|directions|method|preparation|steps)[^\n]*((?:\n\d+\..*)+)/i);
    }
    
    const rawInstructions = instructionsMatch ? instructionsMatch[1].trim() : cocktailContent;
    
    // Format instructions
    const formattedInstructions = formatInstructions(rawInstructions);

    cocktails.push({
      id: `custom-${index + 1}`,
      name,
      formattedIngredients: formattedIngredients.length > 0 ? formattedIngredients : ["See instructions for details"],
      formattedInstructions: formattedInstructions.length > 0 ? formattedInstructions : ["Instructions not available"],
      image: `https://source.unsplash.com/random/?cocktail,${name.replace(/\s+/g, '')}`
    });
  });

  console.log(`Parsed ${cocktails.length} cocktails from response`);
  
  // If we didn't find any cocktails with our parsing, create a default one
  if (cocktails.length === 0) {
    console.log("No cocktails found in response, creating a default one");
    cocktails.push({
      id: "custom-default",
      name: "Mixed Drink",
      formattedIngredients: [
        "30 ml spirit of your choice",
        "15 ml fresh citrus juice",
        "15 ml simple syrup",
        "Ice cubes",
        "Garnish of your choice"
      ],
      formattedInstructions: [
        "Fill a shaker with ice",
        "Add all liquid ingredients",
        "Shake well until chilled",
        "Strain into a glass with fresh ice",
        "Add garnish and enjoy"
      ],
      image: "https://source.unsplash.com/random/?cocktail,mixed"
    });
  }
  
  return cocktails;
}

export async function POST(request) {
  try {
    const requestData = await request.json();
    const ingredients = requestData.ingredients || [];
    
    console.log("Formatted suggestions API received request with ingredients:", ingredients);

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: "Ingredients must be a non-empty array" },
        { status: 400 }
      );
    }

    // Check if API key is available
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasClaudeKey = !!process.env.CLAUDE_API_KEY;
    
    if (!hasGroqKey && !hasOpenAIKey && !hasClaudeKey) {
      console.error("Missing API keys");
      return NextResponse.json(
        { error: "API configuration error", suggestions: [] },
        { status: 500 }
      );
    }
    
    console.log("API keys available:", {
      groq: hasGroqKey,
      openai: hasOpenAIKey,
      claude: hasClaudeKey
    });

    // Prioritize Groq API if available
    if (process.env.GROQ_API_KEY) {
      try {
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
                content: "You are a professional bartender with expertise in creating custom cocktails. Create 2-3 unique cocktail recipes based on the available ingredients. Be creative but practical. Focus only on providing detailed recipes with ingredients, measurements, and instructions. Do not include any references to YouTube videos or tutorials."
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

        if (response.ok) {
          const data = await response.json();
          
          // Add defensive checks for the response structure
          if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            console.error("Unexpected Groq API response structure:", JSON.stringify(data));
            // Continue to fallback APIs
          } else {
            // Safely access the content
            const content = data.choices[0]?.message?.content || "";
            console.log("Groq API response content (first 100 chars):", content.substring(0, 100));
            
            // Parse the response to extract cocktail suggestions
            const cocktails = parseGptResponse(content);
            
            if (cocktails && cocktails.length > 0) {
              console.log(`Successfully parsed ${cocktails.length} cocktails from Groq response`);
              return NextResponse.json({ suggestions: cocktails });
            } else {
              console.warn("Failed to parse cocktails from Groq response");
              // Continue to fallback APIs
            }
          }
        }
      } catch (groqError) {
        console.error("Groq API error:", groqError);
        // Fall back to OpenAI if Groq fails
      }
    }

    // Try Claude API if available
    if (process.env.CLAUDE_API_KEY) {
      try {
        console.log("Attempting to get suggestions with Claude API");
        const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            messages: [
              {
                role: "system",
                content: "You are a professional bartender with expertise in creating custom cocktails. Create 2-3 unique cocktail recipes based on the available ingredients. Format your response as a markdown document with a heading for each cocktail name, followed by an 'Ingredients:' section with a bulleted list, and an 'Instructions:' section with numbered steps. Be creative but practical."
              },
              {
                role: "user",
                content: `I have these ingredients available: ${ingredients.join(", ")}. What cocktails can I make? Please provide detailed recipes with measurements (preferably in ml not oz) and instructions.`
              }
            ]
          })
        });

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          
          // Add defensive checks for the response structure
          if (!claudeData || !claudeData.content || !Array.isArray(claudeData.content) || claudeData.content.length === 0) {
            console.error("Unexpected Claude API response structure:", JSON.stringify(claudeData));
            // Continue to fallback APIs
          } else {
            // Safely access the text property
            const content = claudeData.content[0]?.text || "";
            console.log("Claude API response (first 200 chars):", content.substring(0, 200) + "...");
            
            // Parse the response to extract cocktail suggestions
            const cocktails = parseGptResponse(content);
            
            if (cocktails && cocktails.length > 0) {
              console.log(`Successfully parsed ${cocktails.length} cocktails from Claude response`);
              return NextResponse.json({ suggestions: cocktails });
            } else {
              console.warn("Failed to parse cocktails from Claude response");
              // Continue to fallback APIs
            }
          }
        }
      } catch (claudeError) {
        console.error("Claude API error:", claudeError);
        // If Claude fails, return empty suggestions
      }
    }

    // If we've reached this point, both Groq and Claude APIs failed or returned no suggestions
    console.log("All API attempts failed to return valid cocktail suggestions");

    return NextResponse.json({ suggestions: [] });
  } catch (error) {
    console.error("Error generating formatted suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate formatted suggestions" },
      { status: 500 }
    );
  }
}
