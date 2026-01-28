import dgram from 'dgram'
import net from 'net'
import { v4 as uuidv4 } from 'uuid'
import xml2js from 'xml2js'
import { BrowserWindow } from 'electron'
import { networkInterfaces } from 'os'

// WS-Discovery Probe Message (Enhanced)
const createProbeMessage = (messageId: string, type: string) => `
<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">
  <Header>
    <a:Action mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>
    <a:MessageID>uuid:${messageId}</a:MessageID>
    <a:ReplyTo>
      <a:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:Address>
    </a:ReplyTo>
    <a:To mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>
  </Header>
  <Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <Types>${type}</Types>
    </Probe>
  </Body>
</Envelope>
`.trim()

// Constants
const MULTICAST_ADDRESS = '239.255.255.250'
const ONVIF_PORT = 3702
const HIK_PORT = 37020 // Hikvision SADP port

let socketOnvif: dgram.Socket | null = null
let socketHik: dgram.Socket | null = null
let abortController: AbortController | null = null

export interface DiscoveredDevice {
  ip: string
  uuid: string
  name: string
  manufacturer: string
  xaddrs: string
  type: 'onvif' | 'hikvision' | 'scan'
}

export interface ScanOptions {
  type: 'onvif' | 'range'
  range?: {
    start: string
    end: string
  }
}

// Helper to get subnet broadcast address
function getBroadcastAddress(ip: string, netmask: string): string {
  try {
    const ipParts = ip.split('.').map(Number)
    const maskParts = netmask.split('.').map(Number)
    // Bitwise OR of IP and inverted Netmask
    const broadcastParts = ipParts.map((part, i) => (part | (~maskParts[i] & 255)))
    return broadcastParts.join('.')
  } catch (e) {
    return '255.255.255.255'
  }
}

// Global set to track our own UUIDs to ignore loopback
const sentProbeIds = new Set<string>()

// Extract IP from XAddrs (e.g., http://192.168.1.64/onvif/device_service)
function extractIp(url: string): string | null {
  const match = url.match(/\/\/([^/:]+)/)
  return match ? match[1] : null
}

export function startDiscovery(window: BrowserWindow, options?: ScanOptions) {
  stopDiscovery() // Ensure clean state
  
  abortController = new AbortController()
  
  const type = options?.type || 'onvif'
  
  if (type === 'range' && options?.range) {
    runRangeScan(window, options.range.start, options.range.end, abortController.signal)
  } else {
    // Run both discovery protocols in parallel
    runOnvifDiscovery(window)
    runHikDiscovery(window)
  }
}

function runHikDiscovery(window: BrowserWindow) {
  socketHik = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  socketHik.on('error', (err) => {
    console.error(`[Discovery] HikSocket error:\n${err.stack}`)
    socketHik?.close()
  })

  socketHik.on('message', async (msg, rinfo) => {
    const msgStr = msg.toString()
    console.log(`[Discovery] Hikvision received ${msg.length} bytes from ${rinfo.address}`)
    console.log(`[Discovery] Hik Raw Hex: ${msg.toString('hex')}`)
    console.log(`[Discovery] Hik Raw Str: ${msgStr.replace(/[^ -~]/g, '.')}`) // Print printable chars only

    // Ignore our own probes (Types=inquiry)
    if (msgStr.includes('<Types>inquiry</Types>')) {
        return
    }

    // Simple parsing for Hikvision XML
    if (msgStr.includes('<ProbeMatch>') && msgStr.includes('<DeviceDescription>')) {
      try {
        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true })
        const result = await parser.parseStringPromise(msgStr)
        const match = result['ProbeMatch']
        
        if (match) {
          const ip = match['IPv4Address'] || rinfo.address
          const mac = match['MAC'] || ''
          const model = match['DeviceDescription'] || 'Hikvision Device'
          const serial = match['DeviceSN'] || ''
          
          const device: DiscoveredDevice = {
            ip,
            uuid: mac || serial || uuidv4(),
            name: model,
            manufacturer: 'Hikvision',
            xaddrs: `http://${ip}/onvif/device_service`,
            type: 'hikvision'
          }
          
          window.webContents.send('discovery-device-found', device)
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  })

  socketHik.bind(HIK_PORT, () => {
    const address = socketHik?.address()
    console.log(`[Discovery] Hikvision Listening on ${address?.address}:${address?.port}`)
    socketHik?.setBroadcast(true)
    sendHikProbe()
  })
}

function runOnvifDiscovery(window: BrowserWindow) {
  socketOnvif = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  socketOnvif.on('error', (err) => {
    console.error(`[Discovery] OnvifSocket error:\n${err.stack}`)
    socketOnvif?.close()
  })

  socketOnvif.on('message', async (msg, rinfo) => {
    const msgStr = msg.toString()
    
    // Simple check if it's a ProbeMatch
    if (msgStr.includes('ProbeMatch')) {
      try {
        // ODM-style Parsing: Strip prefixes to handle varying namespaces (tds:, d:, soap-env:, etc.)
        const parser = new xml2js.Parser({ 
            explicitArray: false, 
            ignoreAttrs: true,
            tagNameProcessors: [xml2js.processors.stripPrefix] 
        })
        
        const result = await parser.parseStringPromise(msgStr)
        
        // Deep traversal that is namespace-agnostic
        const envelope = result['Envelope']
        if (!envelope) return

        const body = envelope['Body']
        if (!body) return

        // ProbeMatches can be inside Body directly or nested
        const probeMatchesRoot = body['ProbeMatches']
        if (!probeMatchesRoot) return

        let matches = probeMatchesRoot['ProbeMatch']
        if (!matches) return

        // Normalize to array (single device vs multiple)
        if (!Array.isArray(matches)) {
            matches = [matches]
        }

        for (const match of matches) {
            const xaddrs = match['XAddrs'] || ''
            const scopes = match['Scopes'] || ''
            const endpointRef = match['EndpointReference']
            const address = endpointRef ? (endpointRef['Address'] || '') : ''
            
            // Parse Scopes for device info
            let name = 'Unknown Device'
            let manufacturer = 'Generic'
            let hardware = ''
            
            if (scopes) {
                const scopeList = scopes.split(/\s+/)
                for (const s of scopeList) {
                    const decoded = decodeURIComponent(s)
                    if (decoded.includes('/name/')) name = decoded.split('/name/')[1]
                    if (decoded.includes('/hardware/')) hardware = decoded.split('/hardware/')[1]
                    if (decoded.includes('/manufacturer/')) manufacturer = decoded.split('/manufacturer/')[1]
                }
            }

            // Fallback name logic
            const displayName = hardware ? `${manufacturer} ${hardware}` : `${manufacturer} ${name}`

            const ip = extractIp(xaddrs) || rinfo.address
            const uuid = address.replace('uuid:', '') || uuidv4()

            if (ip) {
                const device: DiscoveredDevice = {
                    ip,
                    uuid,
                    name: displayName.trim(),
                    manufacturer,
                    xaddrs: xaddrs.split(' ')[0], // Take first address
                    type: 'onvif'
                }
                
                console.log(`[Discovery] Found ONVIF Device: ${device.ip} - ${device.name}`)
                window.webContents.send('discovery-device-found', device)
            }
        }
      } catch (e) {
        console.error(`[Discovery] Parse error for ${rinfo.address}:`, e)
      }
    }
  })

  socketOnvif.on('listening', () => {
    const address = socketOnvif?.address()
    console.log(`[Discovery] ONVIF Listening on ${address?.address}:${address?.port}`)
    socketOnvif?.setBroadcast(true) // Enable broadcast for the socket
    
    // Bind to all interfaces to ensure multicast works
    const interfaces = networkInterfaces()
    for (const name in interfaces) {
      const iface = interfaces[name]
      iface?.forEach(config => {
        if (config.family === 'IPv4' && !config.internal) {
          try {
            socketOnvif?.addMembership(MULTICAST_ADDRESS, config.address)
            console.log(`[Discovery] Added membership for ${config.address}`)
          } catch (e) {
            // Ignore if fails (some interfaces don't support multicast)
          }
        }
      })
    }
    
    sendOnvifProbe()
  })

  socketOnvif.bind(0) // Bind to random port to receive responses
}

function sendOnvifProbe() {
  if (!socketOnvif) return
  
  // Types to probe
  const types = [
    'dn:NetworkVideoTransmitter',
    'tds:Device',
    'd:NetworkVideoTransmitter',
    'd:Device'
  ]

  const interfaces = networkInterfaces()

  types.forEach(type => {
    const msgId = uuidv4()
    sentProbeIds.add(msgId)
    const message = Buffer.from(createProbeMessage(msgId, type))
    
    // 1. Send Multicast (Standard)
    try {
        socketOnvif?.send(message, 0, message.length, ONVIF_PORT, MULTICAST_ADDRESS)
    } catch(e) { console.error('[Discovery] ONVIF Multicast failed', e) }

    // 2. Send Directed Broadcast to each interface
    for (const name in interfaces) {
        const iface = interfaces[name]
        iface?.forEach(config => {
            if (config.family === 'IPv4' && !config.internal) {
                const broadcastAddr = getBroadcastAddress(config.address, config.netmask)
                try {
                    socketOnvif?.send(message, 0, message.length, ONVIF_PORT, broadcastAddr)
                } catch(e) { 
                    // Ignore broadcast errors
                }
            }
        })
    }
  })
  
  // Clean up old IDs after 5 seconds
  setTimeout(() => sentProbeIds.clear(), 5000)
  
  console.log(`[Discovery] ONVIF Probes sent (${types.length} types)`)
}

function sendHikProbe() {
  if (!socketHik) return
  const uuid = uuidv4()
  sentProbeIds.add(uuid)
  
  // Use correct Hikvision Probe XML
  const xml = `<?xml version="1.0" encoding="utf-8"?><Probe><Uuid>${uuid}</Uuid><Types>inquiry</Types></Probe>`
  const message = Buffer.from(xml)
  
  const interfaces = networkInterfaces()
  
  // 1. Send Multicast
  try {
     socketHik.send(message, 0, message.length, HIK_PORT, MULTICAST_ADDRESS)
  } catch(e) {}

  // 2. Send Directed Broadcast
  for (const name in interfaces) {
        const iface = interfaces[name]
        iface?.forEach(config => {
            if (config.family === 'IPv4' && !config.internal) {
                const broadcastAddr = getBroadcastAddress(config.address, config.netmask)
                try {
                    socketHik?.send(message, 0, message.length, HIK_PORT, broadcastAddr)
                } catch(e) {}
            }
        })
    }
}

// IP Range Scanning Logic
function ipToLong(ip: string) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function longToIp(long: number) {
  return [long >>> 24, (long >> 16) & 255, (long >> 8) & 255, long & 255].join('.');
}

async function runRangeScan(window: BrowserWindow, startIp: string, endIp: string, signal: AbortSignal) {
  const start = ipToLong(startIp)
  const end = ipToLong(endIp)
  
  const CHUNK_SIZE = 20 // Concurrency
  const scanPorts = [80, 554] // Web, RTSP
  
  for (let i = start; i <= end; i += CHUNK_SIZE) {
    if (signal.aborted) break
    
    const chunk = []
    for (let j = 0; j < CHUNK_SIZE && (i + j) <= end; j++) {
      const ip = longToIp(i + j)
      chunk.push(scanIp(ip, scanPorts))
    }
    
    const results = await Promise.all(chunk)
    results.forEach(res => {
      if (res && res.alive) {
        window.webContents.send('discovery-device-found', {
          ip: res.ip,
          uuid: uuidv4(), // Generate temp UUID
          name: 'Scanned Device',
          manufacturer: 'Unknown',
          xaddrs: `http://${res.ip}`,
          type: 'scan'
        })
      }
    })
  }
}

function scanIp(ip: string, ports: number[]): Promise<{ip: string, alive: boolean}> {
  return new Promise((resolve) => {
    // We only need one port to be open to consider it alive
    let pending = ports.length
    let resolved = false
    
    const tryPort = (port: number) => {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      
      socket.on('connect', () => {
        socket.destroy()
        if (!resolved) {
          resolved = true
          resolve({ ip, alive: true })
        }
      })
      
      socket.on('timeout', () => {
        socket.destroy()
        checkDone()
      })
      
      socket.on('error', () => {
        socket.destroy()
        checkDone()
      })
      
      socket.connect(port, ip)
    }
    
    const checkDone = () => {
      pending--
      if (pending === 0 && !resolved) {
        resolved = true
        resolve({ ip, alive: false })
      }
    }
    
    ports.forEach(tryPort)
  })
}

export function stopDiscovery() {
  if (socketOnvif) {
    socketOnvif.close()
    socketOnvif = null
  }
  if (socketHik) {
    socketHik.close()
    socketHik = null
  }
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  console.log('[Discovery] Stopped')
}
