"use client";
import React, { useState, useRef } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Upload } from "lucide-react";

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl font-bold">Image Size Calculator</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Upload Image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {image && (
            <div className="w-full text-center">
              <img
                src={image}
                alt="Uploaded"
                className="mx-auto rounded-md border border-gray-200 max-h-64 object-contain mb-4"
              />
              <p className="text-sm text-gray-600">
                <strong>Size:</strong>{" "}
                {dimensions.width.toFixed(2)} × {dimensions.height.toFixed(2)} inches
              </p>
              <p className="text-lg font-semibold text-green-600 mt-1">
                Total: ${price}
              </p>
              <Button className="w-full mt-4" onClick={() => setShowModal(true)}>
                Buy Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 text-center">
            <h2 className="text-xl font-semibold mb-3">Order Summary</h2>
            <p className="text-gray-700 mb-1">
              Size: {dimensions.width.toFixed(2)} × {dimensions.height.toFixed(2)} inches
            </p>
            <p className="text-green-600 font-bold mb-4">Total: ${price}</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowModal(false)}>
              Confirm Purchase
            </Button>
            <Button
              variant="outline"
              className="w-full mt-2"
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
