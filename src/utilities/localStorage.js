// Utility functions for working with localStorage

// Save ingredients to localStorage
export const saveIngredients = (ingredients) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userIngredients', JSON.stringify(ingredients));
  }
};

// Load ingredients from localStorage
export const loadIngredients = () => {
  if (typeof window !== 'undefined') {
    const savedIngredients = localStorage.getItem('userIngredients');
    return savedIngredients ? JSON.parse(savedIngredients) : [];
  }
  return [];
};

// Save favorite cocktails to localStorage
export const saveFavorites = (favorites) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('favoriteCocktails', JSON.stringify(favorites));
  }
};

// Load favorite cocktails from localStorage
export const loadFavorites = () => {
  if (typeof window !== 'undefined') {
    const savedFavorites = localStorage.getItem('favoriteCocktails');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  }
  return [];
};

// Clear all data from localStorage
export const clearAllData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('userIngredients');
    localStorage.removeItem('favoriteCocktails');
  }
};
