"use client";
import React, { useState, useRef } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Upload } from "lucide-react";
import Navigation from "../components/Navigation";

const GangSheetBuilder = () => {
  const [image, setImage] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [price, setPrice] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  const PRICE_PER_INCH = 10;
  const DPI = 300; // dots per inch

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const widthInches = img.width / DPI;
        const heightInches = img.height / DPI;
        const total = widthInches * heightInches * PRICE_PER_INCH;

        setImage(dataUrl);
        setDimensions({ width: widthInches, height: heightInches });
        setPrice(total.toFixed(2));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navigation */}
      <Navigation />

      {/* Main Section */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 py-16">
        <Card className="w-full max-w-lg shadow-md border border-gray-200">
          <CardHeader className="pb-0">
            <CardTitle className="text-center text-2xl font-semibold text-gray-800">
              Gang Sheet Builder
            </CardTitle>
            <p className="text-center text-gray-500 text-sm mt-1">
              Upload your image to automatically calculate its print cost.
            </p>
          </CardHeader>

          <CardContent className="flex flex-col items-center space-y-5 mt-6">
            <Button
              variant="outline"
              className="w-full max-w-xs border-gray-300 hover:bg-gray-100"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" /> Upload Image
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {image ? (
              <div className="w-full text-center">
                <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 mb-4">
                  <img
                    src={image}
                    alt="Uploaded"
                    className="mx-auto rounded-md border border-gray-200 max-h-64 object-contain"
                  />
                </div>

                <div className="flex flex-col items-center space-y-1">
                  <p className="text-sm text-gray-600">
                    <strong>Dimensions:</strong>{" "}
                    {dimensions.width.toFixed(2)} × {dimensions.height.toFixed(2)} inches
                  </p>
                  <p className="text-lg font-semibold text-green-600">
                    Total: ${price}
                  </p>
                </div>

                <Button
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setShowModal(true)}
                >
                  Buy Now
                </Button>
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center">
                No image uploaded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm text-center animate-fadeIn">
            <h2 className="text-2xl font-semibold mb-3 text-gray-800">
              Order Summary
            </h2>
            <div className="text-gray-700 mb-4">
              <p>
                <strong>Size:</strong>{" "}
                {dimensions.width.toFixed(2)} × {dimensions.height.toFixed(2)} inches
              </p>
              <p className="text-green-600 font-bold mt-1">Total: ${price}</p>
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowModal(false)}
            >
              Confirm Purchase
            </Button>
            <Button
              variant="outline"
              className="w-full mt-3 border-gray-300 hover:bg-gray-100"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GangSheetBuilder;
