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
  
  // Function to convert file to base64 without compression
  const convertToBase64 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
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
