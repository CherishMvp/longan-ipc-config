import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WVPApiService } from '@/services/wvp-api'
import { useWVPStore } from './device-store'
import { useToast } from '@/composables/useToast'

export interface WVPConfig {
  baseUrl: string
  username: string
  password: string
  enabled: boolean
}

export interface ONVIFConfig {
  defaultUsername: string
  defaultPassword: string
}

export const useSettingsStore = defineStore('settings', () => {
  const wvpConfig = ref<WVPConfig>({
    baseUrl: 'http://192.168.2.38:18080',
    username: 'admin',
    password: 'admin',
    enabled: true
  })
  
  const onvifConfig = ref<ONVIFConfig>({
    defaultUsername: 'admin',
    defaultPassword: 'admin123'
  })
  
  const loading = ref(false)
  const loadingMessage = ref('')
  
  async function loadFromDB() {
    if (!window.electronAPI) return
    
    try {
      const config = await window.electronAPI.getConfig()
      
      if (config['settings.wvp']) {
        wvpConfig.value = { ...wvpConfig.value, ...config['settings.wvp'] }
      }
      
      if (config['settings.onvif']) {
        onvifConfig.value = { ...onvifConfig.value, ...config['settings.onvif'] }
      }
    } catch (e) {
      console.error('Failed to load settings from DB:', e)
    }
  }
  
  async function saveWVPConfig(): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API not available' }
    }
    
    const toast = useToast()
    loading.value = true
    loadingMessage.value = '正在测试 WVP 连接...'
    
    const startTime = Date.now()
    const minLoadingTime = 1500
    
    try {
      const api = new WVPApiService(wvpConfig.value.baseUrl)
      await api.login(wvpConfig.value.username, wvpConfig.value.password)
      toast.success('WVP 连接测试成功')
      
      loadingMessage.value = '正在保存配置...'
      
      await window.electronAPI.saveConfig({
        'settings.wvp': wvpConfig.value
      })
      
      loadingMessage.value = '正在重新初始化 WVP...'
      
      const wvpStore = useWVPStore()
      if (wvpConfig.value.enabled && wvpStore.wvpConnected) {
        await wvpStore.initializeWVP(
          wvpConfig.value.baseUrl,
          wvpConfig.value.username,
          wvpConfig.value.password
        )
      }
      
      const elapsed = Date.now() - startTime
      if (elapsed < minLoadingTime) {
        await new Promise(r => setTimeout(r, minLoadingTime - elapsed))
      }
      
      loading.value = false
      toast.success('配置已保存并生效')
      return { success: true }
    } catch (e: any) {
      const elapsed = Date.now() - startTime
      if (elapsed < minLoadingTime) {
        await new Promise(r => setTimeout(r, minLoadingTime - elapsed))
      }
      
      loading.value = false
      toast.error('连接测试失败: ' + (e.message || '未知错误'))
      return { success: false, error: e.message || '保存失败' }
    }
  }
  
  async function saveONVIFConfig(): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API not available' }
    }
    
    try {
      await window.electronAPI.saveConfig({
        'settings.onvif': onvifConfig.value
      })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || '保存失败' }
    }
  }
  
  loadFromDB()
  
  return {
    wvpConfig,
    onvifConfig,
    loading,
    loadingMessage,
    loadFromDB,
    saveWVPConfig,
    saveONVIFConfig
  }
})