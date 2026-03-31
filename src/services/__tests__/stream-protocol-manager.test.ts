import { describe, it, expect, beforeEach } from 'vitest'
import { StreamProtocolManager } from '../stream-protocol-manager'
import { WVPApiService } from '../wvp-api'

describe('StreamProtocolManager', () => {
  let manager: StreamProtocolManager
  let mockWvpApi: WVPApiService

  beforeEach(() => {
    mockWvpApi = {
      getPlayUrl: vi.fn()
    } as any
    manager = new StreamProtocolManager(mockWvpApi)
  })

  it('should create manager instance', () => {
    expect(manager).toBeInstanceOf(StreamProtocolManager)
  })

  it('should try protocols in order', async () => {
    // Mock first protocol fails, second succeeds
    mockWvpApi.getPlayUrl
      .mockRejectedValueOnce(new Error('http-flv failed'))
      .mockResolvedValueOnce('ws://test.flv')

    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    const url = await manager.getPlayUrl('dev1', 'ch1')
    expect(url).toBe('ws://test.flv')
    expect(mockWvpApi.getPlayUrl).toHaveBeenCalledTimes(2)
  })

  it('should reset protocol index', () => {
    manager.reset()
    // Should not throw
    expect(() => manager.reset()).not.toThrow()
  })
})
