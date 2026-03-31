// scripts/test-concurrent-streams.js
const puppeteer = require('puppeteer')

async function testConcurrentStreams(url, streamCount = 16) {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  
  console.log(`Testing ${streamCount} concurrent streams...`)
  
  await page.goto(url)
  
  // Wait for all streams to load
  await page.waitForSelector('.grid video', { timeout: 30000 })
  
  // Measure performance
  const metrics = await page.metrics()
  
  console.log('Performance Metrics:')
  console.log(`- JS Heap Size: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`- CPU Usage: ${(metrics.cpu * 100).toFixed(2)}%`)
  
  await browser.close()
  
  return metrics
}

testConcurrentStreams('http://localhost:5173/video-wall', 16)
  .then(() => console.log('Test completed'))
  .catch(console.error)
