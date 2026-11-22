import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const { fontFamily } = loadFont("normal", { weights: ["700", "800"], subsets: ["latin"] });

export const INTRO_DURATION = 140; // about 4.7 s at 30 fps

const TERRACOTTA = "#c2410c";
const GLOW = "#ea580c";
const INK = "#1c1917";

/* ---------- Same camera as the Blender render (straight down, 32 m, 50 mm) ---------- */
const CAMERA = { x: 10.05, y: 5.05, height: 32, lens: 50, sensor: 36, aspect: 2000 / 1375 };
type P3 = [number, number, number?];
function project([x, y, z = 0]: P3, W: number, H: number) {
  const halfWidth = ((CAMERA.height - z) * CAMERA.sensor) / (2 * CAMERA.lens);
  const halfHeight = halfWidth / CAMERA.aspect;
  return {
    x: (0.5 + (x - CAMERA.x) / (2 * halfWidth)) * W,
    y: (0.5 - (y - CAMERA.y) / (2 * halfHeight)) * H,
  };
}

/* ---------- What gets drawn, in metres ---------- */
const TOP = 1.23; // top of the cut walls
type Wall = { path: P3[]; label: string; at: P3; start: number };
const WALLS: Wall[] = [
  { path: [[-0.12, 10, TOP], [16.12, 10, TOP]], label: "16.0 m", at: [8.0, 10, TOP], start: 10 },
  { path: [[16, 10.12, TOP], [16, -0.12, TOP]], label: "10.0 m", at: [16, 3.0, TOP], start: 20 },
  { path: [[16.12, 0, TOP], [-0.12, 0, TOP]], label: "16.0 m", at: [9.5, 0, TOP], start: 30 },
  { path: [[0, -0.12, TOP], [0, 10.12, TOP]], label: "10.0 m", at: [0, 3.5, TOP], start: 40 },
  { path: [[0, 5, TOP], [16, 5, TOP]], label: "16.0 m", at: [8.4, 5, TOP], start: 46 },
  { path: [[10, 5, TOP], [10, 0, TOP]], label: "5.0 m", at: [10, 2.2, TOP], start: 54 },
  { path: [[7.4, 0, TOP], [7.4, 2.6, TOP], [9.94, 2.6, TOP]], label: "4.1 m", at: [7.4, 1.6, TOP], start: 58 },
];
const DRAW = 14; // frames to trace one wall

const ROOMS: { name: string; area: string; at: P3; start: number }[] = [
  { name: "Living room", area: "40 m²", at: [3.0, 6.0], start: 86 },
  { name: "Kitchen & dining", area: "40 m²", at: [12.4, 5.75], start: 90 },
  { name: "Bedroom", area: "50 m²", at: [5.8, 2.6], start: 94 },
  { name: "Bathroom", area: "30 m²", at: [12.4, 1.95], start: 98 },
  { name: "Terrace", area: "27 m²", at: [18.4, 7.3], start: 102 },
];

const OUTRO_START = 118;
const OUTRO_END = 134;
const WALL_LABELS_OUT = 80; // wall labels leave before the room sizes arrive

const pathLength = (pts: { x: number; y: number }[]) =>
  pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

/* A label that pops in with a spring, like Remotion's own buttons */
const Pill: React.FC<{
  x: number; y: number; start: number; end?: number; dark?: boolean; children: React.ReactNode; room?: boolean;
}> = ({ x, y, start, end, dark, room, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 170, mass: 0.7 } });
  const exit = end === undefined ? 0 : spring({ frame: frame - end, fps, config: { damping: 200 }, durationInFrames: 10 });
  const s = Math.max(0, enter - exit);
  return (
    <div
      style={{
        position: "absolute", left: x, top: y,
        transform: `translate(-50%, -50%) scale(${s})`,
        opacity: Math.min(1, s * 1.4),
        padding: room ? "12px 26px" : "8px 22px",
        borderRadius: room ? 26 : 999,
        background: dark ? INK : "rgba(255,255,255,0.95)",
        color: dark ? "#fff" : room ? INK : TERRACOTTA,
        border: room ? "none" : `5px solid ${dark ? INK : TERRACOTTA}`,
        boxShadow: "0 18px 36px -14px rgba(0,0,0,0.55)",
        fontFamily, fontWeight: 800, fontSize: room ? 34 : 34, lineHeight: 1.15,
        whiteSpace: "nowrap", textAlign: "center",
      }}
    >
      {children}
    </div>
  );
};

export const HeroIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const pt = (p: P3) => project(p, W, H);

  // Picture: fades in, settles with a spring, and gains its colour once the walls are measured
  const settle = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 40 });
  const imgScale = interpolate(settle, [0, 1], [1.08, 1]);
  const imgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const grey = interpolate(frame, [40, 100], [0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const veil = interpolate(frame, [0, 10, 90, OUTRO_END], [0, 0.32, 0.22, 0], { extrapolateRight: "clamp" });

  // Everything drawn on top leaves together at the end, so the last frame is the clean photo
  const outro = interpolate(frame, [OUTRO_START, OUTRO_END], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#f3eee6", overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: imgOpacity, transform: `scale(${imgScale})` }}>
        <Img
          src={staticFile("hero-render.webp")}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: `grayscale(${grey}) contrast(${1 + grey * 0.1})` }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: `rgba(28,25,23,${veil})` }} />

      <AbsoluteFill style={{ opacity: outro, transform: `scale(${interpolate(outro, [0, 1], [0.985, 1])})` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter id="glow" filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Walls traced one after another */}
          {WALLS.map((w, i) => {
            const pts = w.path.map(pt);
            const len = pathLength(pts);
            const p = interpolate(frame, [w.start, w.start + DRAW], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic),
            });
            const d = pts.map((q, k) => `${k ? "L" : "M"}${q.x} ${q.y}`).join(" ");
            return (
              <path key={i} d={d} fill="none" stroke={GLOW} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round"
                filter="url(#glow)" strokeDasharray={len} strokeDashoffset={len * (1 - p)} opacity={p > 0 ? 1 : 0} />
            );
          })}
        </svg>

        {WALLS.map((w, i) => {
          const q = pt(w.at);
          return <Pill key={i} x={q.x} y={q.y} start={w.start + DRAW - 4} end={WALL_LABELS_OUT + i}>{w.label}</Pill>;
        })}

        {ROOMS.map((r, i) => {
          const q = pt(r.at);
          return (
            <Pill key={i} x={q.x} y={q.y} start={r.start} room>
              {r.name}
              <div style={{ color: TERRACOTTA, fontSize: 28, fontWeight: 700 }}>{r.area}</div>
            </Pill>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
