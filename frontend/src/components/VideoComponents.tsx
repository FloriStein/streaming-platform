import { useWHEP } from "../hooks/useWHEP";

export default function App() {
  const videoRef = useWHEP("http://18.192.233.133:8889/mystream/whep");

  return (
    <div style={{ padding: 20 }}>
      <h2>WebRTC Live Stream</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        style={{
          width: "100%",
          maxWidth: 900,
          background: "black",
        }}
      />
    </div>
  );
}
