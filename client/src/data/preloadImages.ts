export function preloadImages(urls: string[], timeoutMs = 5000) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return Promise.resolve();

  return Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          const img = new Image();
          img.onload = finish;
          img.onerror = finish;
          img.src = src;
          if (img.complete) finish();
          window.setTimeout(finish, timeoutMs);
        }),
    ),
  ).then(() => undefined);
}
