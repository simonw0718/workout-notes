// lib/sync/config.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";


  //之後如果你把 FastAPI 換到別的位址，只要在 .env.local 設：
  //NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000