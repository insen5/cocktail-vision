async function handler({ body }) {
  const { userId } = body;

  if (!userId) {
    return {
      statusCode: 400,
      body: { error: "User ID is required" },
    };
  }

  try {
    const userIngredients = await sql`
      SELECT ui.ingredient_id, i.name, i.category, ui.favorite
      FROM user_ingredients ui
      JOIN ingredients i ON ui.ingredient_id = i.id
      WHERE ui.user_id = ${userId}
      ORDER BY ui.favorite DESC, i.category, i.name
    `;

    return {
      statusCode: 200,
      body: {
        ingredients: userIngredients,
      },
    };
  } catch (error) {
    console.error("Error getting user ingredients:", error);
    return {
      statusCode: 500,
      body: { error: "Failed to get user ingredients" },
    };
  }
}