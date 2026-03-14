/**
 * 带认证的 fetch 封装
 * 自动从 localStorage 读取 accessToken 并附加 Authorization 头
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
