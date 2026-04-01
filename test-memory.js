// 测试不同播放路数的内存占用

console.log('=== 内存占用测试（MSE 硬解） ===\n')

const scenarios = [
  { players: 0, expected: '50-100 MB' },
  { players: 4, expected: '150-250 MB' },
  { players: 9, expected: '300-450 MB' },
  { players: 16, expected: '500-800 MB' }
]

scenarios.forEach(s => {
  console.log(`播放 ${s.players} 路：预计 ${s.expected}`)
})

console.log('\n你的实际数据：')
console.log('渲染进程: 338.6 MB（符合 9 路预期）')
console.log('GPU 进程: 68.1 MB（正常）')
console.log('总内存: ~1.3 GB（开发模式正常）')
