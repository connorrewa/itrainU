import React from 'react';

export default function PresentationOverlay({ onStart }) {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
      <button
        onClick={onStart}
        className="px-6 py-3 bg-primary text-white rounded-lg font-semibold 
                 hover:bg-primary-hover transition-colors duration-200 
                 transform hover:scale-105"
      >
        Start Training
      </button>
    </div>
  );
}