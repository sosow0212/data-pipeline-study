export async function fetchJSON<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : data.error ||
            "요청을 처리하지 못했습니다. 입력값과 서비스 상태를 확인해 주세요.",
    );
  return data;
}
