/** Allow time for the first system permission dialog; release a late grant. */
export function withMicrophoneTimeout(
  request: Promise<MediaStream>,
  timeoutMs = 90_000,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(
        new Error(
          "Нет ответа от микрофона. Разрешите Drift доступ к микрофону в настройках системы и попробуйте снова.",
        ),
      );
    }, timeoutMs);
    request.then(
      (stream) => {
        clearTimeout(timer);
        if (settled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        settled = true;
        resolve(stream);
      },
      (error) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(error);
      },
    );
  });
}
