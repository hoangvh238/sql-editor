import { useEffect, useRef, useState } from "react";

export const db = {
  loadDiagram: (callback) => {
    const handleMessage = (event) => {
      if (event.origin === "http://localhost:3000" && event.data && event.data.dbml) {
        callback(event.data.dbml);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  },
  sendDiagram: (dbml) => {
    window.parent.postMessage({ dbml }, "http://localhost:3000");
  }
};

// Usage Example
export default function DiagramHandler() {
  const [dbmlData, setDbmlData] = useState("");

  useEffect(() => {
    const cleanup = db.loadDiagram(setDbmlData);
    return cleanup;
  }, []);

  return (
    React.createElement("div", null,
      React.createElement("h2", null, "Received DBML Data:"),
      React.createElement("pre", null, dbmlData)
    )
  );
}