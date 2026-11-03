import { useEffect, useRef } from "react";

// Lightweight canvas backdrop: drifting stars with a slow parallax. Static when motion is paused.
export default function Starfield({ motion = true }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let width = 0, height = 0, frame = 0, stars = [];
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round((width * height) / 5200);
      stars = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, z: Math.random() * 0.8 + 0.2, phase: Math.random() * Math.PI * 2 }));
    }
    function draw(time = 0) {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (motion) { star.x -= star.z * 0.06; if (star.x < 0) star.x = width; }
        const twinkle = motion ? 0.55 + Math.sin(time / 900 + star.phase) * 0.45 : 0.7;
        context.globalAlpha = star.z * twinkle * 0.8;
        context.fillStyle = star.z > 0.85 ? "#bdf4ff" : "#8fa8c8";
        context.fillRect(star.x, star.y, star.z * 1.4, star.z * 1.4);
      }
      if (motion) frame = requestAnimationFrame(draw);
    }
    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [motion]);
  return <canvas ref={canvasRef} className="nx-starfield" aria-hidden="true" />;
}
