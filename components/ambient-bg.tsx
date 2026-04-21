"use client";

import { useEffect, useRef } from "react";

/**
 * Subtle animated aurora gradient mesh — atmospheric, not distracting.
 * Think: barely-visible northern lights drifting behind content.
 */
export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Gradient orbs that slowly drift
    const orbs = [
      { x: 0.3, y: 0.2, r: 400, color: [0, 240, 255], speed: 0.0003, phase: 0 },
      { x: 0.7, y: 0.3, r: 350, color: [0, 255, 157], speed: 0.0002, phase: 2 },
      { x: 0.5, y: 0.6, r: 300, color: [124, 58, 237], speed: 0.00025, phase: 4 },
      { x: 0.2, y: 0.7, r: 250, color: [0, 240, 255], speed: 0.00015, phase: 1 },
    ];

    function animate() {
      if (!canvas || !ctx) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);
      time++;

      for (const orb of orbs) {
        const ox = w * (orb.x + Math.sin(time * orb.speed + orb.phase) * 0.08);
        const oy = h * (orb.y + Math.cos(time * orb.speed * 0.7 + orb.phase) * 0.06);

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.r);
        grad.addColorStop(0, `rgba(${orb.color.join(",")}, 0.06)`);
        grad.addColorStop(0.5, `rgba(${orb.color.join(",")}, 0.02)`);
        grad.addColorStop(1, "transparent");

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      animId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}
