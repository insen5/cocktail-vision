export const cocktails = [
  {
    id: 1,
    name: "Mojito",
    description: "A refreshing Cuban highball with mint and lime",
    instructions: "Muddle mint leaves with sugar and lime juice. Add rum, fill glass with ice, top with soda water, and garnish with mint leaves.",
    image: "https://source.unsplash.com/random/?mojito",
    ingredients: [
      { id: 1, name: "White rum", amount: "2", unit: "oz", category: "Spirit" },
      { id: 2, name: "Lime", amount: "1", unit: "", category: "Fruit" },
      { id: 3, name: "Mint leaves", amount: "8-10", unit: "", category: "Herb" },
      { id: 4, name: "Sugar", amount: "2", unit: "tsp", category: "Sweetener" },
      { id: 5, name: "Soda water", amount: "to top", unit: "", category: "Mixer" }
    ]
  },
  {
    id: 2,
    name: "Old Fashioned",
    description: "A classic whiskey cocktail with bitters and sugar",
    instructions: "Muddle sugar cube with bitters and a splash of water. Add bourbon, stir, add ice, and garnish with orange peel.",
    image: "https://source.unsplash.com/random/?oldfashioned",
    ingredients: [
      { id: 6, name: "Bourbon", amount: "2", unit: "oz", category: "Spirit" },
      { id: 7, name: "Sugar cube", amount: "1", unit: "", category: "Sweetener" },
      { id: 8, name: "Angostura bitters", amount: "2-3", unit: "dashes", category: "Bitters" },
      { id: 9, name: "Orange peel", amount: "1", unit: "", category: "Garnish" }
    ]
  },
  {
    id: 3,
    name: "Margarita",
    description: "A tequila-based cocktail with lime and orange liqueur",
    instructions: "Shake tequila, lime juice, and triple sec with ice. Strain into a salt-rimmed glass and garnish with lime wheel.",
    image: "https://source.unsplash.com/random/?margarita",
    ingredients: [
      { id: 10, name: "Tequila", amount: "2", unit: "oz", category: "Spirit" },
      { id: 11, name: "Lime juice", amount: "1", unit: "oz", category: "Juice" },
      { id: 12, name: "Triple sec", amount: "0.5", unit: "oz", category: "Liqueur" },
      { id: 13, name: "Salt", amount: "for rim", unit: "", category: "Garnish" },
      { id: 2, name: "Lime", amount: "1", unit: "wheel", category: "Garnish" }
    ]
  },
  {
    id: 4,
    name: "Negroni",
    description: "A classic Italian cocktail with gin, vermouth, and Campari",
    instructions: "Stir gin, sweet vermouth, and Campari with ice. Strain into a rocks glass with ice and garnish with orange peel.",
    image: "https://source.unsplash.com/random/?negroni",
    ingredients: [
      { id: 14, name: "Gin", amount: "1", unit: "oz", category: "Spirit" },
      { id: 15, name: "Sweet vermouth", amount: "1", unit: "oz", category: "Fortified Wine" },
      { id: 16, name: "Campari", amount: "1", unit: "oz", category: "Bitter Liqueur" },
      { id: 9, name: "Orange peel", amount: "1", unit: "", category: "Garnish" }
    ]
  },
  {
    id: 5,
    name: "Daiquiri",
    description: "A rum cocktail with lime juice and simple syrup",
    instructions: "Shake rum, lime juice, and simple syrup with ice. Strain into a chilled coupe glass.",
    image: "https://source.unsplash.com/random/?daiquiri",
    ingredients: [
      { id: 1, name: "White rum", amount: "2", unit: "oz", category: "Spirit" },
      { id: 11, name: "Lime juice", amount: "0.75", unit: "oz", category: "Juice" },
      { id: 17, name: "Simple syrup", amount: "0.5", unit: "oz", category: "Sweetener" }
    ]
  },
  {
    id: 6,
    name: "Whiskey Sour",
    description: "A bourbon cocktail with lemon juice and simple syrup",
    instructions: "Shake bourbon, lemon juice, simple syrup, and egg white with ice. Strain into a rocks glass with ice and garnish with lemon wheel and cherry.",
    image: "https://source.unsplash.com/random/?whiskeysour",
    ingredients: [
      { id: 6, name: "Bourbon", amount: "2", unit: "oz", category: "Spirit" },
      { id: 18, name: "Lemon juice", amount: "0.75", unit: "oz", category: "Juice" },
      { id: 17, name: "Simple syrup", amount: "0.5", unit: "oz", category: "Sweetener" },
      { id: 19, name: "Egg white", amount: "0.5", unit: "oz", category: "Other" },
      { id: 20, name: "Cherry", amount: "1", unit: "", category: "Garnish" }
    ]
  },
  {
    id: 7,
    name: "Manhattan",
    description: "A whiskey cocktail with sweet vermouth and bitters",
    instructions: "Stir rye whiskey, sweet vermouth, and bitters with ice. Strain into a chilled coupe glass and garnish with cherry.",
    image: "https://source.unsplash.com/random/?manhattan",
    ingredients: [
      { id: 21, name: "Rye whiskey", amount: "2", unit: "oz", category: "Spirit" },
      { id: 15, name: "Sweet vermouth", amount: "1", unit: "oz", category: "Fortified Wine" },
      { id: 8, name: "Angostura bitters", amount: "2", unit: "dashes", category: "Bitters" },
      { id: 20, name: "Cherry", amount: "1", unit: "", category: "Garnish" }
    ]
  },
  {
    id: 8,
    name: "Martini",
    description: "A gin cocktail with dry vermouth",
    instructions: "Stir gin and dry vermouth with ice. Strain into a chilled martini glass and garnish with olive or lemon twist.",
    image: "https://source.unsplash.com/random/?martini",
    ingredients: [
      { id: 14, name: "Gin", amount: "2.5", unit: "oz", category: "Spirit" },
      { id: 22, name: "Dry vermouth", amount: "0.5", unit: "oz", category: "Fortified Wine" },
      { id: 23, name: "Olive", amount: "1", unit: "", category: "Garnish" }
    ]
  },
  {
    id: 9,
    name: "Moscow Mule",
    description: "A vodka cocktail with ginger beer and lime",
    instructions: "Fill a copper mug with ice, add vodka and lime juice, top with ginger beer, and garnish with lime wheel.",
    image: "https://source.unsplash.com/random/?moscowmule",
    ingredients: [
      { id: 24, name: "Vodka", amount: "2", unit: "oz", category: "Spirit" },
      { id: 11, name: "Lime juice", amount: "0.5", unit: "oz", category: "Juice" },
      { id: 25, name: "Ginger beer", amount: "4", unit: "oz", category: "Mixer" },
      { id: 2, name: "Lime", amount: "1", unit: "wheel", category: "Garnish" }
    ]
  },
  {
    id: 10,
    name: "Gin and Tonic",
    description: "A simple highball with gin and tonic water",
    instructions: "Fill a highball glass with ice, add gin, top with tonic water, and garnish with lime wedge.",
    image: "https://source.unsplash.com/random/?ginandtonic",
    ingredients: [
      { id: 14, name: "Gin", amount: "2", unit: "oz", category: "Spirit" },
      { id: 26, name: "Tonic water", amount: "4", unit: "oz", category: "Mixer" },
      { id: 2, name: "Lime", amount: "1", unit: "wedge", category: "Garnish" }
    ]
  }
];

// Create a list of all unique ingredients from the cocktails
export const allIngredients = Array.from(
  new Set(
    cocktails.flatMap(cocktail => 
      cocktail.ingredients.map(ingredient => ingredient.name)
    )
  )
).sort();

// Function to find cocktails that can be made with given ingredients
export function findCocktails(userIngredients) {
  const userIngredientsLower = userIngredients.map(ing => ing.toLowerCase());
  
  return cocktails.map(cocktail => {
    const cocktailIngredients = cocktail.ingredients.map(ing => ing.name.toLowerCase());
    const missingIngredients = cocktailIngredients.filter(
      ing => !userIngredientsLower.includes(ing)
    );
    
    return {
      ...cocktail,
      missingIngredients: missingIngredients,
      canMake: missingIngredients.length === 0,
      matchPercentage: Math.round(
        ((cocktailIngredients.length - missingIngredients.length) / cocktailIngredients.length) * 100
      )
    };
  }).sort((a, b) => {
    // Sort by canMake first, then by matchPercentage
    if (a.canMake !== b.canMake) return b.canMake ? 1 : -1;
    return b.matchPercentage - a.matchPercentage;
  });
}
