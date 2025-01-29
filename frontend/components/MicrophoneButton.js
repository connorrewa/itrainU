import { useState, useEffect, useRef } from 'react';

export default function MicrophoneButton({ isActive, onClick, avatarReady, onSpeechResult }) {
  const [buttonState, setButtonState] = useState('idle'); // idle, listening, processing
  const recognitionRef = useRef(null);

  // Initialize speech recognition on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setButtonState('listening');
        onClick(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setButtonState('processing');
        onSpeechResult(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setButtonState('idle');
        onClick(false);
      };

      recognition.onend = () => {
        if (buttonState !== 'processing') {
          setButtonState('idle');
          onClick(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors when stopping recognition during cleanup
        }
      }
    };
  }, [onClick, onSpeechResult]);

  // Handle avatar ready state changes
  useEffect(() => {
    if (!avatarReady && buttonState === 'processing') {
      return;
    }
    
    if (!avatarReady) {
      setButtonState('idle');
    }
  }, [avatarReady, buttonState]);

  const handleClick = () => {
    if (!recognitionRef.current || !avatarReady) return;

    try {
      if (buttonState === 'idle') {
        recognitionRef.current.start();
      } else if (buttonState === 'listening') {
        recognitionRef.current.stop();
      }
    } catch (error) {
      console.error('Error toggling speech recognition:', error);
      setButtonState('idle');
      onClick(false);
    }
  };

  const getButtonStyles = () => {
    const baseStyles = 'w-40 h-12 rounded-full flex items-center justify-center transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    switch (buttonState) {
      case 'listening':
        return `${baseStyles} bg-red-500 hover:bg-red-600 text-white focus:ring-red-500`;
      case 'processing':
        return `${baseStyles} bg-yellow-500 cursor-not-allowed text-white`;
      default:
        return `${baseStyles} ${
          avatarReady 
            ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500' 
            : 'bg-gray-300 cursor-not-allowed text-gray-500'
        }`;
    }
  };

  const getButtonText = () => {
    switch (buttonState) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      default:
        return avatarReady ? 'Start Speaking' : 'Please wait...';
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={buttonState === 'processing' || !avatarReady}
      className={getButtonStyles()}
    >
      <span className="flex items-center">
        {buttonState === 'listening' && (
          <span className="mr-2 h-2 w-2 bg-white rounded-full animate-pulse" />
        )}
        {getButtonText()}
      </span>
    </button>
  );
}