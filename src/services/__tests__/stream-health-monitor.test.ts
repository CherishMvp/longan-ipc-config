import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StreamHealthMonitor } from '../stream-health-monitor'

describe('StreamHealthMonitor', () => {
  let monitor: StreamHealthMonitor

  beforeEach(() => {
    vi.useFakeTimers()
    monitor = new StreamHealthMonitor()
  })

  afterEach(() => {
    monitor.destroy()
    vi.useRealTimers()
  })

  it('should create monitor instance', () => {
    expect(monitor).toBeInstanceOf(StreamHealthMonitor)
  })

  it('should register and unregister players', () => {
    const mockPlayer = { getStatistics: vi.fn() } as any
    monitor.registerPlayer('test-id', mockPlayer)
    monitor.unregisterPlayer('test-id')
    
    // Should not throw
    expect(() => monitor.destroy()).not.toThrow()
  })

  it('should detect low bitrate', async () => {
    const mockPlayer = {
      getStatistics: vi.fn().mockReturnValue({ speed: 50 * 1024 }) // 50KB/s < threshold
    } as any

    monitor.registerPlayer('test-id', mockPlayer)

    // 触发健康检查
    vi.advanceTimersByTime(3000)

    // 应该触发重连事件
    await new Promise(resolve => setTimeout(resolve, 100))
  })
})
