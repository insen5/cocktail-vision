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
    let rawIngredients = ingredientsMatch 
      ? ingredientsMatch[1].split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.match(/^[-*•]$/))
          .map(line => line.replace(/^[-*•]\s*/, ''))
      : [];
    
    // Format ingredients
    const formattedIngredients = rawIngredients.map(ing => formatIngredient(ing));

    // Extract instructions
    const instructionsMatch = cocktailContent.match(/(?:instructions|directions|method|preparation|steps):(.*?)(?:\n\n|$)/is);
    const rawInstructions = instructionsMatch ? instructionsMatch[1].trim() : cocktailContent;
    
    // Format instructions
    const formattedInstructions = formatInstructions(rawInstructions);

    cocktails.push({
      id: `custom-${index + 1}`,
      name,
      formattedIngredients, // Pre-formatted ingredients ready for display
      formattedInstructions, // Pre-formatted instructions ready for display
      image: `https://source.unsplash.com/random/?cocktail,${name.replace(/\s+/g, '')}`
    });
  });

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
          const content = data.choices[0].message.content;
          
          // Parse the response to extract cocktail suggestions
          const cocktails = parseGptResponse(content);
          
          return NextResponse.json({ suggestions: cocktails });
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
                content: "You are a professional bartender with expertise in creating custom cocktails. Create 2-3 unique cocktail recipes based on the available ingredients. Be creative but practical. Focus only on providing detailed recipes with ingredients, measurements, and instructions. Do not include any references to YouTube videos or tutorials."
              },
              {
                role: "user",
                content: `I have these ingredients available: ${ingredients.join(", ")}. What cocktails can I make? Please provide detailed recipes with measurements and instructions.`
              }
            ]
          })
        });

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          const content = claudeData.content[0].text;
          
          // Parse the response to extract cocktail suggestions
          const cocktails = parseGptResponse(content);
          
          return NextResponse.json({ suggestions: cocktails });
        }
      } catch (claudeError) {
        console.error("Claude API error:", claudeError);
        // Fall back to OpenAI if Claude fails
      }
    }

    // Fall back to OpenAI if available
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "No available API keys could process the request", suggestions: [] },
        { status: 500 }
      );
    }
    
    console.log("Attempting to get suggestions with OpenAI API");
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
    console.error("Error generating formatted suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate formatted suggestions" },
      { status: 500 }
    );
  }
}
