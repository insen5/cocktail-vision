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
  const [uploadedImages, setUploadedImages] = useState([]);
  const [detectedIngredients, setDetectedIngredients] = useState([]);
  
  // Track ingredient sources (detected vs manually added)
  const [ingredientSources, setIngredientSources] = useState({});
  
  // Image upload handling
  const { uploadImage, isUploading } = useUpload({
    onUploadStart: (imageId) => {
      setIsLoading(true);
      setError(null);
    },
    onUploadComplete: (detectedItems, imageId) => {
      if (detectedItems && detectedItems.length > 0) {
        // Update the specific image with detected items
        setUploadedImages(prevImages => {
          const updatedImages = [...prevImages];
          const imageIndex = updatedImages.findIndex(img => img.id === imageId);
          
          if (imageIndex !== -1) {
            updatedImages[imageIndex] = {
              ...updatedImages[imageIndex],
              detectedItems: detectedItems.map(item => item.trim())
            };
            
            // Save to localStorage
            localStorage.setItem('cocktail_vision_uploaded_images', JSON.stringify(updatedImages));
            return updatedImages;
          }
          return prevImages;
        });
        
        // Add new ingredients to the main ingredients list and track their source
        const newIngredients = [...ingredients];
        const newSources = {...ingredientSources};
        let hasNew = false;
        
        detectedItems.forEach(item => {
          const cleanItem = item.trim().toLowerCase();
          if (cleanItem && !newIngredients.includes(cleanItem)) {
            newIngredients.push(cleanItem);
            newSources[cleanItem] = 'detected';
            hasNew = true;
          }
        });
        
        if (hasNew) {
          setIngredients(newIngredients);
          setIngredientSources(newSources);
          saveIngredients(newIngredients);
        }
      }
      setIsLoading(false);
    },
    onUploadError: (err, imageId) => {
      console.error("Image upload error:", err);
      setError("Failed to analyze image. Please try again.");
      setIsLoading(false);
      
      // Remove the specific image if analysis failed
      setUploadedImages(prevImages => {
        const updatedImages = prevImages.filter(img => img.id !== imageId);
        const imageToRemove = prevImages.find(img => img.id === imageId);
        
        if (imageToRemove && imageToRemove.url.startsWith('blob:')) {
          URL.revokeObjectURL(imageToRemove.url);
        }
        
        localStorage.setItem('cocktail_vision_uploaded_images', JSON.stringify(updatedImages));
        return updatedImages;
      });
    }
  });

  useEffect(() => {
    // Load saved ingredients from localStorage
    const savedIngredients = loadIngredients();
    if (savedIngredients && savedIngredients.length > 0) {
      setIngredients(savedIngredients);
    }
    
    // Load saved images if they exist
    try {
      const savedImagesJson = localStorage.getItem('cocktail_vision_uploaded_images');
      if (savedImagesJson) {
        const savedImages = JSON.parse(savedImagesJson);
        if (Array.isArray(savedImages) && savedImages.length > 0) {
          setUploadedImages(savedImages);
        }
      }
    } catch (error) {
      console.error('Error loading saved images:', error);
    }
  }, []);

  const handleAddIngredient = () => {
    if (newIngredient.trim() && !ingredients.includes(newIngredient.trim())) {
      const updatedIngredients = [...ingredients, newIngredient.trim()];
      
      // Track this as a manually added ingredient
      setIngredientSources(prev => ({
        ...prev,
        [newIngredient.trim()]: 'manual'
      }));
      
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
        const file = e.target.files[0];
        // Create a preview URL for the image
        const imageUrl = URL.createObjectURL(file);
        // Generate a unique ID for this image
        const imageId = Date.now().toString();
        
        // Add the new image to the array using function form of setState to ensure we're working with the latest state
        setUploadedImages(prevImages => {
          const newImages = [...prevImages, {
            id: imageId,
            url: imageUrl,
            detectedItems: []
          }];
          
          // Store the images in localStorage
          localStorage.setItem('cocktail_vision_uploaded_images', JSON.stringify(newImages));
          return newImages;
        });
        
        // Upload the image for analysis, passing the image ID
        uploadImage(file, imageId);
      }
    };
    input.click();
  };
  
  const handleRemoveUploadedImage = (imageId) => {
    const imageToRemove = uploadedImages.find(img => img.id === imageId);
    if (imageToRemove && imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    
    const updatedImages = uploadedImages.filter(img => img.id !== imageId);
    setUploadedImages(updatedImages);
    
    // Update localStorage
    if (updatedImages.length > 0) {
      localStorage.setItem('cocktail_vision_uploaded_images', JSON.stringify(updatedImages));
    } else {
      localStorage.removeItem('cocktail_vision_uploaded_images');
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
    
    // Clear all images if present
    uploadedImages.forEach(img => {
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    });
    setUploadedImages([]);
    setDetectedIngredients([]);
    
    // Clear localStorage
    saveIngredients([]);
    localStorage.removeItem('cocktail_vision_ingredients');
    localStorage.removeItem('cocktail_vision_uploaded_images');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            AI Bartender/Cocktail Maker
          </h1>
          <p className="text-xl opacity-80 mb-1">
            Discover classic and unique cocktail recipes with just a photo
          </p>
          <p className="text-sm opacity-60 italic">
            By insen (please enjoy responsibly)
          </p>
        </header>

        <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What's in your bar?</h2>
          
          <div className="mb-6">
            <p className="mb-2">Snap a photo of your fridge or bar</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handlePhotoUpload}
                className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-lg flex items-center justify-center gap-2 transition"
                disabled={isLoading || isUploading}
              >
                <span className="text-xl">📷</span>
                <span>Take Photo or Upload</span>
              </button>
              
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="relative h-16 w-16 flex-shrink-0">
                      <img 
                        src={image.url} 
                        alt="Uploaded image" 
                        className="h-full w-full object-cover rounded-md border-2 border-indigo-400"
                      />
                      <button
                        onClick={() => handleRemoveUploadedImage(image.id)}
                        className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-full text-xs h-5 w-5 flex items-center justify-center"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                {ingredients.map((ingredient, index) => {
                  const source = ingredientSources[ingredient] || 'manual';
                  const isDetected = source === 'detected';
                  
                  return (
                    <li
                      key={index}
                      className={`${isDetected ? 'bg-indigo-700' : 'bg-purple-800'} bg-opacity-50 px-3 py-1 rounded-full flex items-center gap-2`}
                    >
                      {isDetected && <span className="text-green-400 mr-1">✓</span>}
                      <span>{ingredient}</span>
                      <button
                        onClick={() => handleRemoveIngredient(index)}
                        className="text-purple-300 hover:text-white"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
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
          
          {isUploading && (
            <div className="mt-6 bg-indigo-900/30 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Analyzing image...</h3>
                <div className="text-sm">
                  <p className="animate-pulse">Please wait</p>
                </div>
              </div>
            </div>
          )}
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
