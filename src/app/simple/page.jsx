"use client";
import React, { useState, useEffect } from "react";
import { useUpload } from "../../utilities/runtime-helpers";
import { saveIngredients, loadIngredients } from "../../utilities/localStorage";

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

function SimpleCocktailPage() {
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
    onUploadError: (errorMessage) => {
      console.error("Image upload error:", errorMessage);
      // Use the specific error message from our improved error handling
      setError(errorMessage || "Failed to analyze image. Please try again.");
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

  // State for camera stream
  const [cameraStream, setCameraStream] = React.useState(null);
  const videoRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const cameraInputRef = React.useRef(null);
  
  // Function to detect if we're on a mobile device
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };
  
  // Function to handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadImage(e.target.files[0]);
      // Reset the input value to allow selecting the same file again
      e.target.value = '';
    }
  };
  
  // Function to open file picker
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Function to open camera - now simplified since we use a dedicated input
  const handlePhotoUpload = () => {
    // Simply click the camera input element
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    } else {
      // Fallback to regular file input if camera input isn't available
      console.warn('Camera input not available, falling back to file input');
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
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
      // Get cocktail suggestions from the API
      console.log("Requesting cocktail suggestions for ingredients:", ingredients);
      
      // Use the server-side API endpoint for security
      const response = await fetch("/api/get-custom-suggestions", {
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
      
      if (data && data.length > 0) {
        console.log(`Received ${data.length} cocktail suggestions`);
        setCocktails(data);
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

  // Format ingredient for display
  const formatIngredient = (ingredient) => {
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
  };

  // Format instructions for display
  const formatInstructions = (instructions) => {
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
          .replace(/^\s*"|"\s*$/g, '')
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
            {/* Hidden file input for fallback */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload photo"
              id="file-input"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* Camera button - this will trigger the camera input */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-700 py-3 rounded-lg flex items-center justify-center gap-2 transition"
                disabled={isLoading || isUploading}
              >
                <span className="text-xl">📷</span>
                <span>Open Camera</span>
              </button>
              
              {/* Hidden camera input with capture attribute */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading || isUploading}
              />
              
              {/* File upload button for selecting from gallery */}
              <label 
                htmlFor="file-upload" 
                className="bg-purple-600 hover:bg-purple-700 py-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span className="text-xl">📁</span>
                <span>Upload Photo</span>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isLoading || isUploading}
                />
              </label>
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
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8 text-center animate-pulse">
            <div className="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
            {(error.includes('too large') || error.includes('FUNCTION_PAYLOAD_TOO_LARGE')) && (
              <p className="text-sm mt-2 text-red-300">
                Try taking a clearer photo with better lighting, or choose a smaller image.
              </p>
            )}
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
                      {cocktail.ingredients && cocktail.ingredients.length > 0 ? (
                        cocktail.ingredients.map((ingredient, idx) => (
                          <li key={idx} className="flex items-center text-lg">
                            <span className="text-purple-300 mr-3">•</span>
                            <span>{formatIngredient(ingredient)}</span>
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
                      {formatInstructions(cocktail.instructions).map((step, idx) => (
                        <li key={idx} className="text-lg pl-2">
                          <span className="pl-2">{step}</span>
                        </li>
                      ))}
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

export default SimpleCocktailPage;
