"use client";
import React, { useState, useEffect } from "react";
import { useUpload } from "../utilities/runtime-helpers";
import { saveIngredients, loadIngredients } from "../utilities/localStorage";

function MainPage() {
  // State management
  const [ingredients, setIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [cocktails, setCocktails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Image upload handling
  const { uploadImage, isUploading } = useUpload({
    onUploadStart: () => {
      setIsLoading(true);
      setError(null);
    },
    onUploadComplete: (detectedItems) => {
      if (detectedItems && detectedItems.length > 0) {
        const newIngredients = [...ingredients];
        let hasNew = false;
        
        detectedItems.forEach(item => {
          const cleanItem = item.trim().toLowerCase();
          if (cleanItem && !newIngredients.includes(cleanItem)) {
            newIngredients.push(cleanItem);
            hasNew = true;
          }
        });
        
        if (hasNew) {
          setIngredients(newIngredients);
          saveIngredients(newIngredients);
        }
      }
      setIsLoading(false);
    },
    onUploadError: (err) => {
      console.error("Image upload error:", err);
      setError("Failed to analyze image. Please try again.");
      setIsLoading(false);
    }
  });

  useEffect(() => {
    // Load saved ingredients from localStorage
    const savedIngredients = loadIngredients();
    if (savedIngredients && savedIngredients.length > 0) {
      setIngredients(savedIngredients);
    }
  }, []);

  const handleAddIngredient = () => {
    if (newIngredient.trim() && !ingredients.includes(newIngredient.trim())) {
      const updatedIngredients = [...ingredients, newIngredient.trim()];
      setIngredients(updatedIngredients);
      saveIngredients(updatedIngredients);
      setNewIngredient("");
    }
  };

  const handleRemoveIngredient = (index) => {
    const updatedIngredients = [...ingredients];
    updatedIngredients.splice(index, 1);
    setIngredients(updatedIngredients);
    saveIngredients(updatedIngredients);
  };

  const handlePhotoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadImage(e.target.files[0]);
      }
    };
    input.click();
  };

  const getRecommendations = async () => {
    if (ingredients.length === 0) {
      setError("Please add at least one ingredient");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get cocktail suggestions from the new API endpoint that handles formatting
      console.log("Requesting formatted cocktail suggestions for ingredients:", ingredients);
      
      const response = await fetch("/api/get-formatted-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ingredients })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Cocktail suggestions response:", JSON.stringify(data));
      
      if (data && data.suggestions && data.suggestions.length > 0) {
        console.log(`Received ${data.suggestions.length} cocktail suggestions`);
        setCocktails(data.suggestions);
      } else {
        console.warn("No cocktail suggestions returned from API");
        setCocktails([]);
      }
    } catch (error) {
      console.error("Error getting cocktail suggestions:", error);
      setError("Failed to get cocktail suggestions. Please try again.");
      setCocktails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIngredients([]);
    setNewIngredient("");
    setCocktails([]);
    setError(null);
    
    // Clear localStorage
    saveIngredients([]);
    localStorage.removeItem('cocktail_vision_ingredients');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            Cocktail Vision
          </h1>
          <p className="text-xl opacity-80 mb-1">
            Discover cocktail recipes with your ingredients
          </p>
          <p className="text-sm opacity-60 italic">
            By insen (please enjoy responsibly)
          </p>
        </header>

        <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What's in your bar?</h2>
          
          <div className="mb-6">
            <p className="mb-2">Snap a photo of your ingredients</p>
            <button
              onClick={handlePhotoUpload}
              className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-lg flex items-center justify-center gap-2 transition"
              disabled={isLoading || isUploading}
            >
              <span className="text-xl">📷</span>
              <span>Take Photo or Upload</span>
            </button>
          </div>

          <div className="mb-6">
            <p className="mb-2">Or add ingredients manually</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newIngredient}
                onChange={(e) => setNewIngredient(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddIngredient()}
                placeholder="Vodka, lime juice, etc."
                className="flex-1 bg-black bg-opacity-50 border border-purple-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-400"
                disabled={isLoading}
              />
              <button
                onClick={handleAddIngredient}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition"
                disabled={isLoading || !newIngredient.trim()}
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Your Ingredients:</h3>
            {ingredients.length > 0 ? (
              <ul className="flex flex-wrap gap-2 mb-4">
                {ingredients.map((ingredient, index) => (
                  <li
                    key={index}
                    className="bg-purple-800 bg-opacity-50 px-3 py-1 rounded-full flex items-center gap-2"
                  >
                    <span>{ingredient}</span>
                    <button
                      onClick={() => handleRemoveIngredient(index)}
                      className="text-purple-300 hover:text-white"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 italic mb-4">No ingredients added yet</p>
            )}

            <button
              onClick={getRecommendations}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 py-3 rounded-lg font-semibold transition"
              disabled={isLoading || ingredients.length === 0}
            >
              {isLoading ? "Finding Cocktails..." : "Find Cocktails"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8 text-center">
            {error}
          </div>
        )}

        {/* Simplified Cocktail Results Section */}
        {cocktails.length > 0 && (
          <div className="bg-black bg-opacity-30 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Your Cocktail Options</h2>
              <button
                onClick={handleReset}
                className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition"
              >
                Start Over
              </button>
            </div>
            
            <div className="space-y-12">
              {cocktails.map((cocktail, index) => (
                <div key={`cocktail-${index}`} className="border-b border-purple-500/30 pb-8 last:border-0 last:pb-0">
                  <h3 className="text-3xl font-bold text-white mb-6">
                    {cocktail.name}
                  </h3>
                  
                  {/* Ingredients Section */}
                  <div className="mb-8">
                    <h4 className="text-xl font-semibold text-purple-300 mb-3">
                      Ingredients
                    </h4>
                    <ul className="space-y-2">
                      {cocktail.formattedIngredients && cocktail.formattedIngredients.length > 0 ? (
                        cocktail.formattedIngredients.map((ingredient, idx) => (
                          <li key={idx} className="flex items-center text-lg">
                            <span className="text-purple-300 mr-3">•</span>
                            <span>{ingredient}</span>
                          </li>
                        ))
                      ) : (
                        <li>Ingredients not specified</li>
                      )}
                    </ul>
                  </div>
                  
                  {/* Instructions Section */}
                  <div>
                    <h4 className="text-xl font-semibold text-purple-300 mb-3">
                      Instructions
                    </h4>
                    <ol className="list-decimal list-inside space-y-2">
                      {cocktail.formattedInstructions && cocktail.formattedInstructions.length > 0 ? (
                        cocktail.formattedInstructions.map((step, idx) => (
                          <li key={idx} className="text-lg pl-2">
                            <span className="pl-2">{step}</span>
                          </li>
                        ))
                      ) : (
                        <li>Instructions not available</li>
                      )}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;
