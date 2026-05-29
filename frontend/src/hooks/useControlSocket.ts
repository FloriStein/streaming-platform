import { useEffect, useRef, useState } from "react";

type ControlMessage = {
  type: string;
  key?: string;
  action?: string;
  timestamp?: number;
};

export function useControlSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<ControlMessage | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("Control WebSocket connected");
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("Control WebSocket disconnected");
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onmessage = (event) => {
      try {
        const data: ControlMessage = JSON.parse(event.data);
        setLastMessage(data);
      } catch (e) {
        console.error("Invalid message:", event.data);
      }
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return {
    connected,
    lastMessage,
  };
}
