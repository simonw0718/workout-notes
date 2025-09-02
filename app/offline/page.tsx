// app/offline/page.tsx
export const metadata = { title: "離線中" };

export default function OfflinePage() {
  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">目前離線</h1>
      <p className="text-gray-600">
        你仍可在此裝置使用已載入的頁面、並記錄訓練（資料存於本機
        IndexedDB）。恢復連線後可繼續使用。
      </p>
    </main>
  );
}
