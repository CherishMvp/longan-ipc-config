import mpegts from 'mpegts.js'

export interface PlayerStats {
  speed: number
  buffered: number
  droppedFrames: number
}

export class StreamHealthMonitor {
  private players: Map<string, mpegts.Player> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly CHECK_INTERVAL_MS = 3000
  private readonly MIN_SPEED_BYTES = 100 * 1024 // 100KB/s

  constructor() {
    this.startHealthCheck()
  }

  registerPlayer(id: string, player: mpegts.Player): void {
    this.players.set(id, player)
  }

  unregisterPlayer(id: string): void {
    this.players.delete(id)
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.players.forEach((player, id) => {
        try {
          const stats = player.getStatistics()
          
          if (stats.speed < this.MIN_SPEED_BYTES) {
            console.warn(`[StreamHealth] Low bitrate detected: ${id}, speed: ${stats.speed}B/s`)
            
            // 触发自定义事件，播放器组件监听
            window.dispatchEvent(new CustomEvent('stream-reconnect', { detail: { playerId: id } }))
          }
        } catch (error) {
          console.error(`[StreamHealth] Error checking player ${id}:`, error)
        }
      })
    }, this.CHECK_INTERVAL_MS)
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    this.players.clear()
  }
}

// 单例
export const healthMonitor = new StreamHealthMonitor()
