// lib/bus.ts

type Handler = () => void;

let favoritesHandlers: Handler[] = [];

export function onFavoritesChanged(handler: Handler) {
  favoritesHandlers.push(handler);
}

export function offFavoritesChanged(handler: Handler) {
  favoritesHandlers = favoritesHandlers.filter((h) => h !== handler);
}

export function emitFavoritesChanged() {
  for (const h of favoritesHandlers) {
    try {
      h();
    } catch (e) {
      console.error("Error in favorites handler", e);
    }
  }
}
