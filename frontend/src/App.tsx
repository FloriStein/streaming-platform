import { useRef } from "react";
import { useWHEP } from "./hooks/useWHEP";
import { ControlListener } from "./ControlListener";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useWHEP(videoRef);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        style={{ width: "100%" }}
      />
      <div>
        <ControlListener url="ws://3.126.131.56:8081" />
      </div>
    </>
  );
}
