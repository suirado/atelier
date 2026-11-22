import React from "react";
import { Composition } from "remotion";
import { HeroIntro, INTRO_DURATION } from "./HeroIntro";

// Same aspect ratio as the render (2000 × 1375)
export const Root: React.FC = () => (
  <Composition
    id="HeroIntro"
    component={HeroIntro}
    durationInFrames={INTRO_DURATION}
    fps={30}
    width={1600}
    height={1100}
  />
);
