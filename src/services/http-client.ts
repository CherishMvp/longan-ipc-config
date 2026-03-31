export class HttpClient {
  private defaultTimeout = 10000

  async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout)

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      return await res.json()
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }
}
