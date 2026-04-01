<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLogger, LogType, LogEntry } from '@/composables/useLogger'
import { FileText, Play, Wifi, AppWindow, AlertCircle, Trash2, Search } from 'lucide-vue-next'
import Card from '@/components/ui/card/Card.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Input from '@/components/ui/input/Input.vue'
import Button from '@/components/ui/button/Button.vue'
import Badge from '@/components/ui/badge/Badge.vue'

const logger = useLogger()

onMounted(() => {
  logger.loadFromDB()
})

const activeType = ref<LogType | 'all'>('all')
const searchQuery = ref('')
const expandedLog = ref<number | null>(null)

const filters: { id: LogType | 'all', name: string, icon: any }[] = [
  { id: 'all', name: '全部', icon: FileText },
  { id: 'player', name: '播放器', icon: Play },
  { id: 'wvp', name: 'WVP API', icon: Wifi },
  { id: 'app', name: '应用', icon: AppWindow },
  { id: 'error', name: '错误', icon: AlertCircle }
]

const filteredLogs = computed(() => {
  let result = logger.logs.value
  
  if (activeType.value !== 'all') {
    result = result.filter(l => l.type === activeType.value)
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(l => 
      l.message.toLowerCase().includes(query) ||
      (l.data && JSON.stringify(l.data).toLowerCase().includes(query))
    )
  }
  
  return result
})

function getLevelColor(level: LogEntry['level']) {
  return level === 'error' ? 'bg-red-500' : level === 'warn' ? 'bg-yellow-500' : 'bg-green-500'
}

function getTypeColor(type: LogEntry['type']) {
  return type === 'player' ? 'bg-blue-500' : type === 'wvp' ? 'bg-purple-500' : type === 'app' ? 'bg-gray-500' : 'bg-red-500'
}

function toggleExpand(id: number) {
  expandedLog.value = expandedLog.value === id ? null : id
}

async function handleClear() {
  await logger.clearLogs()
}
</script>

<template>
  <div class="flex gap-6 h-full">
    <aside class="w-48 flex flex-col gap-2">
      <button
        v-for="filter in filters"
        :key="filter.id"
        @click="activeType = filter.id"
        class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all"
        :class="[
          activeType === filter.id
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
        ]"
      >
        <component :is="filter.icon" class="w-4 h-4" />
        <span>{{ filter.name }}</span>
      </button>
      
      <div class="mt-4 px-4 text-xs text-muted-foreground">
        共 {{ logger.logs.value.length }} 条日志
      </div>
    </aside>
    
    <div class="flex-1 flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <div class="flex-1 flex items-center gap-2">
          <Search class="w-4 h-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="搜索日志..."
            class="flex-1"
          />
        </div>
        
        <Button variant="outline" size="sm" @click="handleClear">
          <Trash2 class="w-4 h-4 mr-2" />
          清除全部
        </Button>
      </div>
      
      <Card class="flex-1 overflow-hidden">
        <CardContent class="p-0 h-full overflow-y-auto">
          <div v-if="filteredLogs.length === 0" class="p-8 text-center text-muted-foreground">
            暂无日志
          </div>
          
          <div v-else class="divide-y">
            <div
              v-for="log in filteredLogs"
              :key="log.id"
              class="p-4 hover:bg-muted/50 cursor-pointer transition-all"
              @click="toggleExpand(log.id)"
            >
              <div class="flex items-center gap-3">
                <Badge :class="getLevelColor(log.level)" class="text-xs">
                  {{ log.level }}
                </Badge>
                
                <Badge :class="getTypeColor(log.type)" class="text-xs">
                  {{ log.type }}
                </Badge>
                
                <span class="text-xs text-muted-foreground font-mono">{{ log.time }}</span>
                
                <span class="flex-1 text-sm truncate">{{ log.message }}</span>
                
                <span class="text-xs text-muted-foreground">
                  {{ expandedLog === log.id ? '▼' : '▶' }}
                </span>
              </div>
              
              <div v-if="expandedLog === log.id && log.data" class="mt-3 p-3 bg-muted/30 rounded text-xs font-mono overflow-auto max-h-40">
                <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>