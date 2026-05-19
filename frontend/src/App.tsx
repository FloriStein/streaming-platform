import { useRef } from "react";
import { useWHEP } from "./hooks/useWHEP";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useWHEP(videoRef);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      controls
      style={{ width: "100%" }}
    />
  );
}
