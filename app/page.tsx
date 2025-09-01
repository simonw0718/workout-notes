"use client";

import { useEffect, useState } from "react";

// IndexedDB 簡單測試：儲存一個 key/value
async function testIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TestDB", 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore("notes", { keyPath: "id" });
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = db.transaction("notes", "readwrite");
      const store = tx.objectStore("notes");
      store.put({ id: 1, text: "Hello IndexedDB" });
      tx.oncomplete = () => resolve("ok");
    };

    request.onerror = () => reject(request.error);
  });
}

export default function Home() {
  const [dbStatus, setDbStatus] = useState<string>("pending");

  useEffect(() => {
    testIndexedDB()
      .then(() => setDbStatus("IndexedDB ✅"))
      .catch(() => setDbStatus("IndexedDB ❌"));
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("Hello Clipboard");
      alert("已複製到剪貼簿");
    } catch (err) {
      alert("複製失敗：" + err);
    }
  };

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">環境驗收測試</h1>
      <p>{dbStatus}</p>
      <button
        onClick={handleCopy}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        測試複製到剪貼簿
      </button>
    </main>
  );
}
