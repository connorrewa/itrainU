import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';

const GoogleSlides = forwardRef(({ presentationId }, ref) => {
  const [currentSlide, setCurrentSlide] = useState(1);
  const iframeRef = useRef(null);

  const embedUrl = `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`;

  useImperativeHandle(ref, () => ({
    goToNextSlide: () => {
      setCurrentSlide((prevSlide) => prevSlide + 1);
      if (iframeRef.current) {
        iframeRef.current.src = `${embedUrl}#slide=${currentSlide + 1}`;
      }
    },
    goToPreviousSlide: () => {
      setCurrentSlide((prevSlide) => Math.max(1, prevSlide - 1));
      if (iframeRef.current) {
        iframeRef.current.src = `${embedUrl}#slide=${currentSlide - 1}`;
      }
    },
    getCurrentSlide: () => currentSlide,
    startPresentation: () => {
      setCurrentSlide(1);
      if (iframeRef.current) {
        iframeRef.current.src = `${embedUrl}#slide=1`;
      }
    }
  }));

  return (
    <div className="relative w-full h-full">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        frameBorder="0"
        className="w-full h-full"
        allowFullScreen
      />
    </div>
  );
});

GoogleSlides.displayName = 'GoogleSlides';
export default GoogleSlides;