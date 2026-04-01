<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { Settings2, Wifi } from 'lucide-vue-next'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Input from '@/components/ui/input/Input.vue'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import SettingsLoadingOverlay from '@/components/SettingsLoadingOverlay.vue'

const settingsStore = useSettingsStore()
const toast = useToast()

const activeModule = ref<'wvp' | 'onvif'>('wvp')

const modules: { id: 'wvp' | 'onvif', name: string, icon: any }[] = [
  { id: 'wvp', name: 'WVP 视频平台', icon: Settings2 },
  { id: 'onvif', name: 'ONVIF 默认认证', icon: Wifi }
]

async function handleSaveWVP() {
  await settingsStore.saveWVPConfig()
}

async function handleSaveONVIF() {
  const result = await settingsStore.saveONVIFConfig()
  
  if (result.success) {
    toast.success('ONVIF 配置已保存')
  } else {
    toast.error(result.error || '保存失败')
  }
}
</script>

<template>
  <div class="flex gap-6">
    <SettingsLoadingOverlay />
    
    <aside class="w-48 flex flex-col gap-2">
      <button
        v-for="module in modules"
        :key="module.id"
        @click="activeModule = module.id"
        class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all"
        :class="[
          activeModule === module.id
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
        ]"
      >
        <component :is="module.icon" class="w-4 h-4" />
        <span>{{ module.name }}</span>
      </button>
    </aside>
    
    <div class="flex-1">
      <Card v-if="activeModule === 'wvp'">
        <CardHeader>
          <CardTitle>WVP 视频平台配置</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">API 地址</label>
            <Input
              v-model="settingsStore.wvpConfig.baseUrl"
              placeholder="http://192.168.2.38:18080"
            />
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">用户名</label>
            <Input
              v-model="settingsStore.wvpConfig.username"
              placeholder="admin"
            />
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">密码</label>
            <Input
              v-model="settingsStore.wvpConfig.password"
              type="password"
              placeholder="admin"
            />
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">启用 WVP 功能</label>
            <Switch
              :checked="settingsStore.wvpConfig.enabled"
              @update:checked="settingsStore.wvpConfig.enabled = $event"
            />
          </div>
          
          <div class="flex gap-3 mt-4">
            <Button @click="handleSaveWVP" :disabled="settingsStore.loading">
              保存并生效
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card v-if="activeModule === 'onvif'">
        <CardHeader>
          <CardTitle>ONVIF 默认认证配置</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">默认用户名</label>
            <Input
              v-model="settingsStore.onvifConfig.defaultUsername"
              placeholder="admin"
            />
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">默认密码</label>
            <Input
              v-model="settingsStore.onvifConfig.defaultPassword"
              type="password"
              placeholder="admin123"
            />
          </div>
          
          <div class="flex gap-3 mt-4">
            <Button @click="handleSaveONVIF">
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>