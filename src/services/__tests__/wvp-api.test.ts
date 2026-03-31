import { describe, it, expect, beforeEach } from 'vitest'
import { WVPApiService } from '../wvp-api'

describe('WVPApiService', () => {
  let service: WVPApiService
  const mockBaseUrl = 'http://192.168.2.38:18080'

  beforeEach(() => {
    service = new WVPApiService(mockBaseUrl)
  })

  it('should create service instance', () => {
    expect(service).toBeInstanceOf(WVPApiService)
  })

  it('should have login method', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: { token: 'mock-token' }
      })
    })

    const token = await service.login('admin', 'la1688')
    expect(token).toBe('mock-token')
  })

  it('should get devices list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          list: [
            { deviceId: '1', name: 'Device 1', status: 'online', channels: [] }
          ]
        }
      })
    })

    // @ts-ignore - mock token
    service.token = 'mock-token'
    const devices = await service.getDevices()
    expect(devices).toHaveLength(1)
  })

  it('should get play URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: { url: 'http://test.flv', type: 'http-flv' }
      })
    })

    // @ts-ignore - mock token
    service.token = 'mock-token'
    const url = await service.getPlayUrl('dev1', 'ch1', 'http-flv')
    expect(url).toBe('http://test.flv')
  })
})
