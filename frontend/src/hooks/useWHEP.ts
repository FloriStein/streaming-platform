import { useEffect } from "react";

export function useWHEP(videoRef: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const start = async () => {
      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:3.126.131.56",
          },
          {
            urls: "turn:3.126.131.56?transport=udp",
            username: "testuser",
            credential: "testpass",
          },
        ],
      });

      pc.addTransceiver("video", {
        direction: "recvonly",
      });

      pc.ontrack = (event) => {
        console.log("TRACK RECEIVED");

        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      // WICHTIG:
      // Warten bis ICE fertig gesammelt wurde
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          };

          pc.addEventListener("icegatheringstatechange", checkState);
        }
      });

      console.log("FINAL SDP:");
      console.log(pc.localDescription?.sdp);

      const response = await fetch("http://3.126.131.56/mystream/whep", {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: pc.localDescription?.sdp,
      });

      const answer = await response.text();

      console.log("ANSWER SDP:");
      console.log(answer);

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answer,
      });
    };

    start();
  }, [videoRef]);
}
