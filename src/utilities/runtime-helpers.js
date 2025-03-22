import React from 'react';

function useHandleStreamResponse({
  onChunk,
  onFinish
}) {
  const handleStreamResponse = React.useCallback(
    async (response) => {
      if (response.body) {
        const reader = response.body.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let content = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              onFinish(content);
              break;
            }
            const chunk = decoder.decode(value, { stream: true });
            content += chunk;
            onChunk(content);
          }
        }
      }
    },
    [onChunk, onFinish]
  );
  return handleStreamResponse;
}

function useUpload({ onUploadStart, onUploadComplete, onUploadError }) {
  const [isUploading, setIsUploading] = React.useState(false);
  
  // Function to convert file to base64 with smart size handling
  const convertToBase64 = async (file) => {
    // Check file size in MB
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`Original image size: ${fileSizeMB.toFixed(2)} MB`);
    
    // If file is larger than 2MB, resize it while maintaining quality
    // This ensures we stay well under API payload limits
    if (fileSizeMB > 2) {
      console.log("Image is large, applying smart resizing");
      return resizeImageSmartly(file, fileSizeMB);
    }
    
    // For smaller files, use without compression
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  // Function to resize large images while maintaining quality
  // The fileSizeMB parameter helps determine how aggressive the resizing should be
  const resizeImageSmartly = (file, fileSizeMB = 0) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Calculate target dimensions - maintain aspect ratio but limit max dimension
          // Adjust maxDimension and quality based on original file size
          let maxDimension = 1500; // Default max width or height in pixels
          let quality = 0.85; // Default JPEG compression quality
          
          // For very large images, be more aggressive with resizing
          if (fileSizeMB > 6) {
            maxDimension = 1200;
            quality = 0.8;
          } else if (fileSizeMB > 4) {
            maxDimension = 1350;
            quality = 0.82;
          }
          
          let width = img.width;
          let height = img.height;
          
          // Determine scale factor if image is larger than maxDimension
          if (width > maxDimension || height > maxDimension) {
            const scaleFactor = Math.min(
              maxDimension / width,
              maxDimension / height
            );
            width = Math.round(width * scaleFactor);
            height = Math.round(height * scaleFactor);
          }
          
          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to high-quality JPEG
          const resizedImage = canvas.toDataURL('image/jpeg', quality);
          console.log("Image resized successfully");
          resolve(resizedImage);
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadImage = React.useCallback(async (file, imageId) => {
    if (!file) {
      console.error("No file provided");
      if (onUploadError) onUploadError("No file provided", imageId);
      return;
    }
    
    try {
      setIsUploading(true);
      if (onUploadStart) onUploadStart(imageId);
      
      // Convert the file to base64 without compression
      console.log("Converting image to base64");
      const imageBase64 = await convertToBase64(file);
      console.log("Image converted successfully");
      
      // Send the resized base64 image to the analyze-image API
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64 }),
      });
      
      if (!response.ok) {
        // Get more specific error information if available
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            throw new Error(errorData.error);
          }
        } catch (jsonError) {
          // If we can't parse the error JSON, use the status code
        }
        
        // Handle specific HTTP status codes
        if (response.status === 413) {
          throw new Error('Image is too large. Please try a smaller image or take a clearer photo.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please try again in a moment.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        
        throw new Error(`Image analysis failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Image analysis response:", data);
      
      if (onUploadComplete) {
        onUploadComplete(data.allDetected || [], imageId);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      
      // Provide more user-friendly error messages based on the error
      let userMessage = error.message || "Failed to analyze image";
      
      // Check for network-related errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your internet connection.';
      }
      
      // Check for specific error messages
      if (userMessage.includes('FUNCTION_PAYLOAD_TOO_LARGE') || 
          userMessage.includes('too large')) {
        userMessage = 'The image is too large. Please try a smaller image or take a clearer photo.';
      }
      
      if (onUploadError) {
        onUploadError(userMessage, imageId);
      }
    } finally {
      setIsUploading(false);
    }
  }, [onUploadStart, onUploadComplete, onUploadError]);
  
  return { uploadImage, isUploading };
}

export {
  useHandleStreamResponse,
  useUpload,
}
