"use client";
import React, { useState, useEffect } from "react";
import { useUpload } from "../utilities/runtime-helpers";
import { cocktails, allIngredients, findCocktails } from "../data/cocktails";
import { saveIngredients, loadIngredients, saveFavorites, loadFavorites } from "../utilities/localStorage";
import { getCustomSuggestions } from "../utilities/openai-client.js";

function MainComponent() {
  const [ingredients, setIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [customSuggestions, setCustomSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("input");
  const [imagePreview, setImagePreview] = useState(null);
  const [userId, setUserId] = useState(
    `user-${Math.random().toString(36).substring(2, 9)}`
  );
  const [upload, { loading: uploadLoading }] = useUpload();
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    // Load ingredients and favorites from localStorage
    const savedIngredients = loadIngredients();
    if (savedIngredients && savedIngredients.length > 0) {
      setIngredients(savedIngredients);
    }
    
    const savedFavorites = loadFavorites();
    if (savedFavorites && savedFavorites.length > 0) {
      setFavorites(savedFavorites);
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

  const captureImage = () => {
    const cameraInput = document.createElement("input");
    cameraInput.type = "file";
    cameraInput.accept = "image/*";
    cameraInput.capture = "environment";
    cameraInput.style.display = "none";

    const galleryInput = document.createElement("input");
    galleryInput.type = "file";
    galleryInput.accept = "image/*";
    galleryInput.style.display = "none";

    cameraInput.addEventListener("change", handleImageUpload);
    galleryInput.addEventListener("change", handleImageUpload);

    document.body.appendChild(cameraInput);
    document.body.appendChild(galleryInput);

    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      const useCamera = window.confirm("Take a photo or choose from library?");
      if (useCamera) {
        cameraInput.click();
      } else {
        galleryInput.click();
      }
    } else {
      galleryInput.click();
    }

    setTimeout(() => {
      document.body.removeChild(cameraInput);
      document.body.removeChild(galleryInput);
    }, 1000);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const { url, error: uploadError } = await upload({ file });

      if (uploadError) {
        throw new Error(uploadError);
      }

      setImagePreview(url);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64String = e.target.result.split(",")[1];

        try {
          // Use OpenAI Vision API directly from the client side
          const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
          
          if (!apiKey) {
            throw new Error("OpenAI API key not found");
          }
          
          console.log("Calling OpenAI Vision API to analyze image...");
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "gpt-4-vision-preview",
              messages: [
                {
                  role: "system",
                  content: "You are a helpful assistant that identifies cocktail ingredients from images. List only the ingredients you can see, separated by commas. Be concise."
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "What cocktail ingredients can you identify in this image?" },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:image/jpeg;base64,${base64String}`
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
            throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
          }
          
          const data = await response.json();
          const ingredientsText = data.choices[0]?.message?.content || "";
          console.log("Vision API response:", ingredientsText);
          
          // Parse ingredients from the response
          const detectedIngredients = ingredientsText
            .split(",")
            .map(item => item.trim())
            .filter(item => item.length > 0);
          
          if (detectedIngredients.length > 0) {
            // Add detected ingredients to the list
            setIngredients(prev => {
              const newIngredients = [...prev];
              detectedIngredients.forEach(ingredient => {
                if (!newIngredients.includes(ingredient)) {
                  newIngredients.push(ingredient);
                }
              });
              return newIngredients;
            });
          } else {
            setError("No ingredients detected in the image. Please add ingredients manually.");
          }
        } catch (err) {
          console.error("Error analyzing image with OpenAI:", err);
          setError("Failed to analyze image. Please try again or add ingredients manually.");
        }
      };
      

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error analyzing image:", error);
      setError(
        "Failed to analyze image. Please try again or add ingredients manually."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendations = async () => {
    if (ingredients.length === 0) {
      setError("Please add at least one ingredient");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the findCocktails function from our static data
      const matchedCocktails = findCocktails(ingredients);
      setRecommendations(matchedCocktails);

      // For custom suggestions, we'll use client-side OpenAI API
      if (ingredients.length > 0) {
        try {
          console.log("Requesting custom suggestions for ingredients:", ingredients);
          
          // Use the client-side utility instead of the API route
          const suggestions = await getCustomSuggestions(ingredients);
          console.log("Custom suggestions response:", suggestions);
          
          if (suggestions && suggestions.length > 0) {
            setCustomSuggestions(suggestions);
          }
        } catch (error) {
          console.error("Error getting custom suggestions:", error);
          // Don't set an error here as we still have the regular recommendations
        }
      }

      setActiveTab("results");
    } catch (error) {
      console.error("Error getting recommendations:", error);
      setError("Failed to get cocktail recommendations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIngredients([]);
    setNewIngredient("");
    setRecommendations([]);
    setCustomSuggestions([]);
    setImagePreview(null);
    setActiveTab("input");
    setError(null);
    
    // Clear localStorage
    saveIngredients([]);
    saveFavorites([]);
  };

  const toggleFavorite = async (cocktailId) => {
    try {
      setRecommendations(
        recommendations.map((cocktail) =>
          cocktail.id === cocktailId
            ? { ...cocktail, isFavorite: !cocktail.isFavorite }
            : cocktail
        )
      );
    } catch (error) {
      console.error("Error toggling favorite:", error);
      setRecommendations(
        recommendations.map((cocktail) =>
          cocktail.id === cocktailId
            ? { ...cocktail, isFavorite: !cocktail.isFavorite }
            : cocktail
        )
      );
    }
  };

  const rateCocktail = async (cocktailId, rating, comment = "") => {
    try {
      setRecommendations(
        recommendations.map((cocktail) =>
          cocktail.id === cocktailId
            ? { ...cocktail, userRating: rating, userComment: comment }
            : cocktail
        )
      );
    } catch (error) {
      console.error("Error rating cocktail:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            Cocktail Vision
          </h1>
          <p className="text-xl opacity-80 mb-1">
            Discover cocktails you can make with what you have
          </p>
          <p className="text-sm opacity-60 italic">
            - by insen (please enjoy responsibly)
          </p>
        </header>

        {error && (
          <div className="bg-red-500 bg-opacity-80 text-white p-3 rounded-lg mb-4 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-white">
              ×
            </button>
          </div>
        )}

        {activeTab === "input" ? (
          <div className="bg-black bg-opacity-30 rounded-xl p-6 backdrop-blur-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                What's in your bar?
              </h2>

              <div className="mb-6">
                <p className="mb-2">Snap a photo of your fridge or bar</p>
                <div className="flex flex-col md:flex-row gap-4">
                  <button
                    onClick={captureImage}
                    className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg text-center transition flex items-center justify-center"
                    disabled={isLoading || uploadLoading}
                  >
                    <span className="mr-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span>
                      {isLoading || uploadLoading
                        ? "Processing..."
                        : "Take Photo or Upload"}
                    </span>
                  </button>

                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview of bar ingredients"
                        className="h-24 w-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => setImagePreview(null)}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <p className="mb-2">Or add ingredients manually</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="ingredient"
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    placeholder="Vodka, lime juice, etc."
                    className="flex-1 bg-black bg-opacity-50 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleAddIngredient()
                    }
                  />
                  <button
                    onClick={handleAddIngredient}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition"
                    disabled={isLoading}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">
                  Your Ingredients:
                </h3>
                {ingredients.length === 0 ? (
                  <p className="text-gray-400 italic">
                    No ingredients added yet
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ingredients.map((ingredient, index) => (
                      <div
                        key={index}
                        className={`${
                          favorites.includes(ingredient)
                            ? "bg-yellow-700"
                            : "bg-indigo-800"
                        } rounded-full px-3 py-1 flex items-center gap-1`}
                      >
                        {favorites.includes(ingredient) && (
                          <span className="text-yellow-400 mr-1">★</span>
                        )}
                        <span>{ingredient}</span>
                        <button
                          onClick={() => handleRemoveIngredient(index)}
                          className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={getRecommendations}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 py-3 rounded-lg font-bold text-lg transition"
                disabled={isLoading || ingredients.length === 0}
              >
                {isLoading ? "Loading..." : "Find Cocktails"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-black bg-opacity-30 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Your Cocktail Options</h2>
              <button
                onClick={() => setActiveTab("input")}
                className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition"
              >
                Back to Ingredients
              </button>
            </div>

            {recommendations.length === 0 && customSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xl mb-4">
                  No cocktails found with your ingredients
                </p>
                <button
                  onClick={handleReset}
                  className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg transition"
                >
                  Start Over
                </button>
              </div>
            ) : (
              <div>
                {recommendations.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-4">
                      Recommended Cocktails
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recommendations.map((cocktail) => (
                        <div
                          key={cocktail.id}
                          className={`rounded-lg overflow-hidden border ${
                            cocktail.canMake
                              ? "border-green-500"
                              : "border-yellow-500"
                          }`}
                        >
                          {cocktail.image_url && (
                            <div className="h-48 overflow-hidden relative">
                              <img
                                src={cocktail.image_url}
                                alt={`${cocktail.name} cocktail`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={() => toggleFavorite(cocktail.id)}
                                className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-2"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill={
                                    cocktail.isFavorite
                                      ? "currentColor"
                                      : "none"
                                  }
                                  stroke="currentColor"
                                  className="w-6 h-6 text-yellow-400"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                          <div className="p-4 bg-black bg-opacity-50">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-lg font-bold">
                                {cocktail.name}
                              </h4>
                              <div
                                className={`px-2 py-1 rounded text-sm ${
                                  cocktail.canMake
                                    ? "bg-green-600"
                                    : "bg-yellow-600"
                                }`}
                              >
                                {cocktail.canMake
                                  ? "Can Make!"
                                  : `${cocktail.matchPercentage}% Match`}
                              </div>
                            </div>

                            {cocktail.difficulty && (
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-sm text-gray-300">
                                  Difficulty:
                                </span>
                                <span
                                  className={`text-sm px-2 py-0.5 rounded ${
                                    cocktail.difficulty === "Easy"
                                      ? "bg-green-700"
                                      : cocktail.difficulty === "Medium"
                                      ? "bg-yellow-700"
                                      : "bg-red-700"
                                  }`}
                                >
                                  {cocktail.difficulty}
                                </span>
                                {cocktail.prep_time && (
                                  <span className="text-sm text-gray-300 ml-2">
                                    {cocktail.prep_time} min
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="mb-3">
                              <h5 className="font-semibold mb-1">
                                Ingredients:
                              </h5>
                              <ul className="list-disc list-inside">
                                {cocktail.ingredients.map((item, idx) => (
                                  <li
                                    key={idx}
                                    className={
                                      ingredients.some((i) =>
                                        item && i
                                          ? i.toLowerCase() ===
                                            item.name.toLowerCase()
                                          : false
                                      )
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }
                                  >
                                    {item.amount && item.unit
                                      ? `${item.amount} ${item.unit} ${item.name}`
                                      : item.name}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {!cocktail.canMake && (
                              <div className="mb-3">
                                <h5 className="font-semibold mb-1">Missing:</h5>
                                <ul className="list-disc list-inside text-red-400">
                                  {cocktail.missingIngredients.map(
                                    (item, idx) => (
                                      <li key={idx}>{item}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            <div className="mb-3">
                              <h5 className="font-semibold mb-1">
                                Instructions:
                              </h5>
                              <p className="text-gray-300">
                                {cocktail.instructions}
                              </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-700">
                              <h5 className="font-semibold mb-1">
                                Rate this cocktail:
                              </h5>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() =>
                                      rateCocktail(cocktail.id, star)
                                    }
                                    className={`text-2xl ${
                                      (cocktail.userRating || 0) >= star
                                        ? "text-yellow-400"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {customSuggestions.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-4">
                      Custom Suggestions
                    </h3>
                    <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-lg">✨</span>
                        </div>
                        <h4 className="text-lg font-bold">
                          AI Bartender Suggestions
                        </h4>
                      </div>
                      <div className="whitespace-pre-line">
                        {customSuggestions[0].instructions}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center mt-8">
                  <button
                    onClick={handleReset}
                    className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg transition"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-t-indigo-500 border-r-transparent border-b-indigo-500 border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xl">Working on it...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainComponent;