import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const requestData = await request.json();
    const { body } = requestData;
    const { imageBase64 } = body || requestData;
    
    console.log("API received request with data structure:", JSON.stringify(requestData, null, 2));

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OpenAI API key");
      return NextResponse.json(
        { error: "API configuration error", allDetected: [] },
        { status: 500 }
      );
    }

    // Call OpenAI API to analyze the image
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "This is an image of ingredients that could be used for cocktails. Please identify all visible ingredients (fruits, liquors, mixers, garnishes, etc.) that could be used in cocktail making. List ONLY the names of the ingredients you can see, separated by commas. Be specific but concise (e.g., 'lime' not 'green citrus fruit'). If you see bottles, try to identify what type of alcohol or mixer they contain."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the ingredients from the response
    let ingredients = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ingredients = JSON.parse(jsonMatch[0]);
      } else {
        ingredients = content
          .split(/,|\\n/)
          .map((item) => item.trim())
          .filter(
            (item) =>
              item.length > 0 &&
              !item.toLowerCase().includes("i don't see") &&
              !item.toLowerCase().includes("cannot identify")
          )
          .map((item) => item.replace(/^[\s\u2022\-\u2013\u2014*]+|^[0-9]+\.?\s*/g, ""));
      }
    } catch (parseError) {
      console.error("Error parsing ingredients:", parseError);
      ingredients = [];
    }

    return NextResponse.json({
      allDetected: ingredients
    });
  } catch (error) {
    console.error("Error analyzing image:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
