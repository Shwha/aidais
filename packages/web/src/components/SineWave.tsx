import { useRef, useEffect } from "react";

interface SineWaveProps {
  isActive: boolean;
  color: string;
}

export function SineWave({ isActive, color }: SineWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const midY = height / 2;

    let targetAmplitude = 0;
    let currentAmplitude = 0;

    function draw() {
      if (!ctx) return;

      targetAmplitude = isActive ? midY * 0.6 : 0;
      currentAmplitude += (targetAmplitude - currentAmplitude) * 0.08;

      ctx.clearRect(0, 0, width, height);

      if (currentAmplitude < 0.5) {
        // Draw flat line when inactive
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.stroke();
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      phaseRef.current += 0.06;

      // Draw multiple overlapping waves for richness
      for (let wave = 0; wave < 3; wave++) {
        const freq = 0.015 + wave * 0.008;
        const amp = currentAmplitude * (1 - wave * 0.25);
        const phaseOffset = wave * 1.2;
        const alpha = 1 - wave * 0.3;

        ctx.beginPath();
        for (let x = 0; x <= width; x++) {
          const y =
            midY +
            Math.sin(x * freq + phaseRef.current + phaseOffset) * amp +
            Math.sin(x * freq * 2.5 + phaseRef.current * 1.3) * amp * 0.2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2 - wave * 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, color]);

  return (
    <canvas
      ref={canvasRef}
      className="h-8 w-full"
      style={{ display: "block" }}
    />
  );
}
