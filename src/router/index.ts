import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页' }
      },
      {
        path: 'gas-config',
        name: 'GasConfig',
        component: () => import('@/views/gas-config/index.vue'),
        meta: { title: 'IPC气体配置' }
      },
      {
        path: 'discovery',
        name: 'DeviceDiscovery',
        component: () => import('@/views/discovery/index.vue'),
        meta: { title: '设备自动发现' }
      },
      {
        path: 'video-wall',
        name: 'VideoWall',
        component: () => import('@/views/video/VideoWall.vue'),
        meta: { title: '监控大屏' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '设置' }
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/logs/index.vue'),
        meta: { title: '日志' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
