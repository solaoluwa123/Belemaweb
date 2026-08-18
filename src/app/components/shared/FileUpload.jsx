import { useRef } from "react";
import { Button } from "../ui/button";
import { Upload, X, FileText } from "lucide-react";
import { useState } from "react";

export function FileUpload({
  onFileSelect,
  accept = ".csv,.xlsx,.xls",
  maxSize = 10,
  label = "Upload File",
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    setError("");
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {!selectedFile ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 h-32 border-dashed border-2"
        >
          <Upload className="w-6 h-6" />
          <div className="text-center">
            <p className="font-medium">{label}</p>
            <p className="text-xs text-gray-500 mt-1">
              {accept} (Max {maxSize}MB)
            </p>
          </div>
        </Button>
      ) : (
        <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <p className="font-medium text-sm">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
