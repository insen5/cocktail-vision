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
  
  // Function to resize an image to reduce payload size
  const resizeImage = async (file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      // Create a FileReader to read the file
      const reader = new FileReader();
      
      // Set up the FileReader onload event
      reader.onload = (readerEvent) => {
        // Create an image object
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          
          // Create a canvas and resize the image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert the canvas to a data URL (base64)
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        
        // Handle image loading error
        img.onerror = reject;
        
        // Set the image source to the FileReader result
        img.src = readerEvent.target.result;
      };
      
      // Handle FileReader errors
      reader.onerror = reject;
      
      // Read the file as a data URL
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
      
      // Resize the image before sending to reduce payload size
      console.log("Resizing image before upload");
      const resizedImage = await resizeImage(file);
      console.log("Image resized successfully");
      
      // Send the resized base64 image to the analyze-image API
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: resizedImage }),
      });
      
      if (!response.ok) {
        throw new Error(`Image analysis failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Image analysis response:", data);
      
      if (onUploadComplete) {
        onUploadComplete(data.allDetected || [], imageId);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      if (onUploadError) {
        onUploadError(error.message || "Failed to analyze image", imageId);
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
