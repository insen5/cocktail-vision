async function handler({ body }) {
  const { ingredients = [], userId, ingredientIds = [] } = body;

  if (!userId && ingredients.length === 0 && ingredientIds.length === 0) {
    return {
      statusCode: 400,
      body: {
        error: "Either userId, ingredients, or ingredientIds must be provided",
      },
    };
  }

  try {
    if (userId && ingredients.length > 0) {
      await sql`DELETE FROM user_ingredients WHERE user_id = ${userId}`;

      for (const ingredientName of ingredients) {
        const existingIngredient = await sql`
          SELECT id FROM ingredients WHERE LOWER(name) = LOWER(${ingredientName})
        `;

        if (existingIngredient.length > 0) {
          await sql`
            INSERT INTO user_ingredients (user_id, ingredient_id)
            VALUES (${userId}, ${existingIngredient[0].id})
            ON CONFLICT (user_id, ingredient_id) DO NOTHING
          `;
        } else {
          const newIngredient = await sql`
            INSERT INTO ingredients (name, category)
            VALUES (${ingredientName}, 'User Added')
            RETURNING id
          `;

          await sql`
            INSERT INTO user_ingredients (user_id, ingredient_id)
            VALUES (${userId}, ${newIngredient[0].id})
          `;
        }
      }
    }

    let userIngredientIds = [...ingredientIds];
    let ingredientsList = [...ingredients].map((i) => i.toLowerCase());

    if (userId) {
      const userIngredients = await sql`
        SELECT ui.ingredient_id, i.name 
        FROM user_ingredients ui
        JOIN ingredients i ON ui.ingredient_id = i.id
        WHERE ui.user_id = ${userId}
      `;

      userIngredientIds = [
        ...userIngredientIds,
        ...userIngredients.map((item) => item.ingredient_id),
      ];

      ingredientsList = [
        ...ingredientsList,
        ...userIngredients.map((item) => item.name.toLowerCase()),
      ];
    } else if (ingredients.length > 0 && ingredientIds.length === 0) {
      const ingredientRecords = await sql`
        SELECT id FROM ingredients 
        WHERE LOWER(name) IN (${ingredientsList})
      `;
      userIngredientIds = ingredientRecords.map((item) => item.id);
    }

    if (userIngredientIds.length === 0 && ingredientsList.length === 0) {
      return {
        statusCode: 200,
        body: {
          recommendations: [],
          customSuggestions: [],
          message: "No ingredients found to make recommendations",
        },
      };
    }

    let userRatings = [];
    if (userId) {
      userRatings = await sql`
        SELECT cocktail_id, rating, comment
        FROM cocktail_ratings
        WHERE user_id = ${userId}
      `;
    }

    const possibleCocktails = await sql`
      WITH user_ings AS (
        SELECT unnest(${userIngredientIds}::int[]) AS ingredient_id
      ),
      cocktail_required_count AS (
        SELECT 
          ci.cocktail_id,
          COUNT(DISTINCT ci.ingredient_id) AS required_count
        FROM cocktail_ingredients ci
        GROUP BY ci.cocktail_id
      ),
      cocktail_matching_count AS (
        SELECT 
          ci.cocktail_id,
          COUNT(DISTINCT ui.ingredient_id) AS matching_count
        FROM cocktail_ingredients ci
        JOIN user_ings ui ON ci.ingredient_id = ui.ingredient_id
        GROUP BY ci.cocktail_id
      )
      SELECT 
        c.*,
        crc.required_count,
        COALESCE(cmc.matching_count, 0) AS matching_count,
        COALESCE(cmc.matching_count, 0)::float / crc.required_count AS match_percentage
      FROM cocktails c
      JOIN cocktail_required_count crc ON c.id = crc.cocktail_id
      LEFT JOIN cocktail_matching_count cmc ON c.id = cmc.cocktail_id
      WHERE COALESCE(cmc.matching_count, 0) > 0
      ORDER BY match_percentage DESC, c.name
    `;

    const cocktailsWithIngredients = await Promise.all(
      possibleCocktails.map(async (cocktail) => {
        const ingredients = await sql`
          SELECT 
            ci.ingredient_id, 
            i.name, 
            i.category,
            ci.amount, 
            ci.unit,
            ${userIngredientIds}::int[] @> ARRAY[ci.ingredient_id]::int[] AS is_available
          FROM cocktail_ingredients ci
          JOIN ingredients i ON ci.ingredient_id = i.id
          WHERE ci.cocktail_id = ${cocktail.id}
          ORDER BY is_available DESC, i.category, i.name
        `;

        const missingIngredients = ingredients
          .filter((ing) => !ing.is_available)
          .map((ing) => ing.name);

        const userRating = userRatings.find(
          (r) => r.cocktail_id === cocktail.id
        );

        return {
          ...cocktail,
          ingredients,
          missingIngredients,
          canMake: missingIngredients.length === 0,
          matchPercentage: Math.round(cocktail.match_percentage * 100),
          userRating: userRating ? userRating.rating : null,
          userComment: userRating ? userRating.comment : null,
        };
      })
    );

    cocktailsWithIngredients.sort((a, b) => {
      if (a.canMake !== b.canMake) return b.canMake ? 1 : -1;
      return b.matchPercentage - a.matchPercentage;
    });

    let userIngredientNames = ingredientsList;
    if (userIngredientIds.length > 0 && ingredientsList.length === 0) {
      const ingredientRecords = await sql`
        SELECT name FROM ingredients 
        WHERE id IN (${userIngredientIds})
      `;
      userIngredientNames = ingredientRecords.map((item) => item.name);
    }

    let customSuggestions = [];
    if (ingredients.length > 0) {
      const response = await fetch("/integrations/chat-gpt/conversationgpt4", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a professional bartender with expertise in creating custom cocktails. Create 2-3 unique cocktail recipes based on the available ingredients. Be creative but practical.",
            },
            {
              role: "user",
              content: `I have these ingredients available: ${userIngredientNames.join(
                ", "
              )}. What cocktails can I make? Please provide detailed recipes with measurements and instructions.`,
            },
          ],
          json_schema: {
            name: "cocktail_suggestions",
            schema: {
              type: "object",
              properties: {
                cocktails: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      ingredients: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            amount: { type: "string" },
                            unit: { type: "string" },
                          },
                          required: ["name", "amount", "unit"],
                          additionalProperties: false,
                        },
                      },
                      instructions: {
                        type: "array",
                        items: { type: "string" },
                      },
                      glassware: { type: "string" },
                      garnish: { type: "string" },
                    },
                    required: [
                      "name",
                      "description",
                      "ingredients",
                      "instructions",
                      "glassware",
                      "garnish",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["cocktails"],
              additionalProperties: false,
            },
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        try {
          const content = data.choices[0].message.content;
          const parsedContent = JSON.parse(content);

          customSuggestions = parsedContent.cocktails.map((cocktail) => {
            let formattedInstructions = `**${cocktail.name}**\n\n`;
            formattedInstructions += `${cocktail.description}\n\n`;

            formattedInstructions += `**Ingredients:**\n`;
            cocktail.ingredients.forEach((ing) => {
              formattedInstructions += `- ${ing.amount} ${ing.unit} ${ing.name}\n`;
            });

            formattedInstructions += `\n**Instructions:**\n`;
            cocktail.instructions.forEach((step, index) => {
              formattedInstructions += `${index + 1}. ${step}\n`;
            });

            formattedInstructions += `\n**Glass:** ${cocktail.glassware}\n`;
            formattedInstructions += `**Garnish:** ${cocktail.garnish}`;

            return {
              name: cocktail.name,
              instructions: formattedInstructions,
              isCustom: true,
            };
          });
        } catch (parseError) {
          console.error("Error parsing AI response:", parseError);
          customSuggestions = [
            {
              name: "AI Cocktail Suggestions",
              instructions: data.choices[0].message.content,
              isCustom: true,
            },
          ];
        }
      }
    }

    return {
      statusCode: 200,
      body: {
        recommendations: cocktailsWithIngredients.slice(0, 10),
        customSuggestions,
      },
    };
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return {
      statusCode: 500,
      body: { error: "Failed to get cocktail recommendations" },
    };
  }
}