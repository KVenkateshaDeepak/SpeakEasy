import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Base radius
      const baseRadius = 40;
      // Dynamic radius based on volume
      const dynamicRadius = baseRadius + (volume * 50);

      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius, 0, 2 * Math.PI);
      
      if (isActive) {
        ctx.fillStyle = `rgba(99, 102, 241, ${0.3 + volume})`; // Indigo with opacity
        ctx.fill();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#4F46E5'; // Indigo-600
        ctx.fill();
        
        // Ripples
        ctx.beginPath();
        ctx.arc(centerX, centerY, dynamicRadius + 20, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.2 * volume})`;
        ctx.lineWidth = 2;
        ctx.stroke();

      } else {
        // Inactive state
        ctx.fillStyle = '#E2E8F0'; // Slate-200
        ctx.fill();
        
        // Icon placeholder visual
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
        ctx.fillStyle = '#94A3B8';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, volume]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={300} 
      className="w-full h-full max-w-[300px] max-h-[300px]"
    />
  );
};

export default Visualizer;