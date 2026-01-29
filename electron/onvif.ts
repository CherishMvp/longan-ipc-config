import axios from 'axios'
import crypto from 'crypto'
import xml2js from 'xml2js'

// --- Types ---

export interface DeviceInfo {
  manufacturer: string
  model: string
  firmwareVersion: string
  serialNumber: string
  hardwareId: string
}

export interface NetworkConfig {
  dhcp: boolean
  ip: string
  subnet: string
  gateway: string
  dns1?: string
  dns2?: string
}

// --- Constants ---

const NAMESPACES = {
  soap: 'http://www.w3.org/2003/05/soap-envelope',
  tds: 'http://www.onvif.org/ver10/device/wsdl',
  tt: 'http://www.onvif.org/ver10/schema',
  trt: 'http://www.onvif.org/ver10/media/wsdl'
}

// --- Helpers ---

// Allow passing a specific time for authentication to handle time drift
function createSoapHeader(username?: string, password?: string, authTime?: Date) {
  if (!username || !password) return ''

  const createdDate = authTime || new Date()
  const created = createdDate.toISOString()
  const nonceBuffer = crypto.randomBytes(16)
  const nonceBase64 = nonceBuffer.toString('base64')
  
  // PasswordDigest = Base64 ( SHA-1 ( nonce + created + password ) )
  const shasum = crypto.createHash('sha1')
  shasum.update(nonceBuffer)
  shasum.update(Buffer.from(created))
  shasum.update(Buffer.from(password))
  const passwordDigest = shasum.digest('base64')

  return `
    <Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <UsernameToken>
        <Username>${username}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${passwordDigest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceBase64}</Nonce>
        <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>
      </UsernameToken>
    </Security>
  `
}

function createSoapEnvelope(body: string, header: string = '') {
  return `
    <s:Envelope xmlns:s="${NAMESPACES.soap}" xmlns:tds="${NAMESPACES.tds}" xmlns:tt="${NAMESPACES.tt}" xmlns:trt="${NAMESPACES.trt}">
      <s:Header>${header}</s:Header>
      <s:Body>${body}</s:Body>
    </s:Envelope>
  `.trim()
}

async function sendSoapRequest(url: string, body: string, username?: string, password?: string, action?: string, authTime?: Date) {
  const header = createSoapHeader(username, password, authTime)
  const envelope = createSoapEnvelope(body, header)

  try {
    const response = await axios.post(url, envelope, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        ...(action ? { 'action': action } : {})
      },
      timeout: 5000
    })
    return response.data
  } catch (error: any) {
    if (error.response && error.response.status === 400) {
        console.error('SOAP 400 Bad Request. Body:', error.response.data)
    }
    console.error('SOAP Request Error:', error.message)
    throw error
  }
}

// Internal helper to get device time for authentication synchronization
async function getDeviceTimeForAuth(url: string): Promise<Date | null> {
    try {
        const body = '<tds:GetSystemDateAndTime/>'
        let xml = ''
        try {
            const envelope = createSoapEnvelope(body, '')
            const res = await axios.post(url, envelope, { 
                headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
                timeout: 2000
            })
            xml = res.data
        } catch (e) {
            return null
        }

        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
        const result = await parser.parseStringPromise(xml)
        const utc = result?.Envelope?.Body?.GetSystemDateAndTimeResponse?.SystemDateAndTime?.UTCDateTime
        if (utc) {
            return new Date(Date.UTC(utc.Date.Year, utc.Date.Month - 1, utc.Date.Day, utc.Time.Hour, utc.Time.Minute, utc.Time.Second))
        }
    } catch (e) {}
    return null
}

// --- Commands ---

// 0. GetDeviceInformation
export async function getDeviceInformation(url: string, username?: string, password?: string): Promise<DeviceInfo> {
  const authTime = (await getDeviceTimeForAuth(url)) || new Date()
  const body = '<tds:GetDeviceInformation/>'
  const xml = await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation', authTime)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const info = result?.Envelope?.Body?.GetDeviceInformationResponse
  if (!info) throw new Error('Invalid response for GetDeviceInformation')

  return {
    manufacturer: info.Manufacturer || 'Unknown',
    model: info.Model || 'Unknown',
    firmwareVersion: info.FirmwareVersion || 'Unknown',
    serialNumber: info.SerialNumber || 'Unknown',
    hardwareId: info.HardwareId || 'Unknown'
  }
}

// 1. GetNetworkInterfaces
export async function getNetworkSettings(url: string, username?: string, password?: string): Promise<{ token: string, config: NetworkConfig }> {
  const authTime = (await getDeviceTimeForAuth(url)) || new Date()
  const body = '<tds:GetNetworkInterfaces/>'
  const xml = await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/GetNetworkInterfaces', authTime)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const interfaceInfo = result?.Envelope?.Body?.GetNetworkInterfacesResponse?.NetworkInterfaces
  if (!interfaceInfo) throw new Error('Invalid response for GetNetworkInterfaces')

  const iface = Array.isArray(interfaceInfo) ? interfaceInfo[0] : interfaceInfo
  
  const attrParser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const attrResult = await attrParser.parseStringPromise(xml)
  const attrIface = attrResult?.Envelope?.Body?.GetNetworkInterfacesResponse?.NetworkInterfaces
  const targetIface = Array.isArray(attrIface) ? attrIface[0] : attrIface
  const token = targetIface?.$?.token || ''

  const ipv4 = iface.IPv4?.Config
  if (!ipv4) throw new Error('No IPv4 Config found')

  return {
    token,
    config: {
      dhcp: ipv4.DHCP === 'true',
      ip: ipv4.Manual?.Address || ipv4.FromDHCP?.Address || '',
      subnet: ipv4.Manual?.PrefixLength ? prefixLengthToSubnet(Number(ipv4.Manual.PrefixLength)) : '255.255.255.0', 
      gateway: '', 
      dns1: '',
      dns2: ''
    }
  }
}

function prefixLengthToSubnet(length: number) {
  const mask = ~((1 << (32 - length)) - 1)
  return [
    (mask >>> 24) & 0xff,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff
  ].join('.')
}

function subnetToPrefixLength(subnet: string) {
  const parts = subnet.split('.').map(Number)
  let binary = ''
  parts.forEach(part => binary += part.toString(2).padStart(8, '0'))
  return binary.indexOf('0') === -1 ? 32 : binary.indexOf('0')
}

// 2. SetNetworkInterfaces
export async function setNetworkSettings(url: string, token: string, config: NetworkConfig, username?: string, password?: string) {
  const authTime = (await getDeviceTimeForAuth(url)) || new Date()
  const prefixLength = subnetToPrefixLength(config.subnet)
  
  const body = `
    <tds:SetNetworkInterfaces>
      <tds:InterfaceToken>${token}</tds:InterfaceToken>
      <tds:NetworkInterface>
        <tt:IPv4>
          <tt:Enabled>true</tt:Enabled>
          <tt:Manual>
            <tt:Address>${config.ip}</tt:Address>
            <tt:PrefixLength>${prefixLength}</tt:PrefixLength>
          </tt:Manual>
          <tt:DHCP>${config.dhcp}</tt:DHCP>
        </tt:IPv4>
      </tds:NetworkInterface>
    </tds:SetNetworkInterfaces>
  `
  await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/SetNetworkInterfaces', authTime)
}

// 3. SystemReboot
export async function systemReboot(url: string, username?: string, password?: string) {
  const authTime = (await getDeviceTimeForAuth(url)) || new Date()
  const body = '<tds:SystemReboot/>'
  const xml = await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/SystemReboot', authTime)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const msg = result?.Envelope?.Body?.SystemRebootResponse?.Message
  return msg || 'Rebooting...'
}

// 4. GetNetworkProtocols
export async function getNetworkProtocols(url: string, username?: string, password?: string) {
  const authTime = (await getDeviceTimeForAuth(url)) || new Date()
  const body = '<tds:GetNetworkProtocols/>'
  const xml = await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/GetNetworkProtocols', authTime)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const protocols = result?.Envelope?.Body?.GetNetworkProtocolsResponse?.NetworkProtocols
  if (!protocols) return { http: 80, rtsp: 554 }

  const list = Array.isArray(protocols) ? protocols : [protocols]
  let http = 80
  let rtsp = 554
  
  list.forEach((p: any) => {
    if (p.Name === 'HTTP' && p.Enabled === 'true') http = Number(p.Port) || 80
    if (p.Name === 'RTSP' && p.Enabled === 'true') rtsp = Number(p.Port) || 554
  })
  
  return { http, rtsp }
}

// 5. SetUser
export async function setUser(url: string, targetUsername: string, newPassword: string, username?: string, password?: string) {
  const authTime = (await getDeviceTimeForAuth(url)) || new Date()
  const body = `
    <tds:SetUser>
      <tds:User>
        <tt:Username>${targetUsername}</tt:Username>
        <tt:Password>${newPassword}</tt:Password>
        <tt:UserLevel>Administrator</tt:UserLevel>
      </tds:User>
    </tds:SetUser>
  `
  await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/SetUser', authTime)
}

// 6. GetSystemDateAndTime
export async function getSystemDateAndTime(url: string, username?: string, password?: string) {
  const body = '<tds:GetSystemDateAndTime/>'
  const xml = await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/GetSystemDateAndTime')
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const dateTime = result?.Envelope?.Body?.GetSystemDateAndTimeResponse?.SystemDateAndTime
  if (!dateTime) throw new Error('Failed to get time')

  const type = dateTime.DateTimeType || 'Manual'
  const utc = dateTime.UTCDateTime
  
  let displayTime = 'Unknown'
  if (utc) {
    const time = utc.Time
    const date = utc.Date
    displayTime = `${date.Year}-${date.Month}-${date.Day} ${time.Hour}:${time.Minute}:${time.Second}`
  }

  return { type, displayTime, raw: dateTime }
}

// 7. SetSystemDateAndTime
export async function setSystemDateAndTime(url: string, username?: string, password?: string) {
  const authTime = (await getDeviceTimeForAuth(url)) || new Date()
  const now = new Date()
  const utcYear = now.getUTCFullYear()
  const utcMonth = now.getUTCMonth() + 1
  const utcDay = now.getUTCDate()
  const utcHour = now.getUTCHours()
  const utcMinute = now.getUTCMinutes()
  const utcSecond = now.getUTCSeconds()

  const body = `
    <tds:SetSystemDateAndTime>
      <tds:DateTimeType>Manual</tds:DateTimeType>
      <tds:DaylightSavings>false</tds:DaylightSavings>
      <tds:UTCDateTime>
        <tds:Time>
          <tds:Hour>${utcHour}</tds:Hour>
          <tds:Minute>${utcMinute}</tds:Minute>
          <tds:Second>${utcSecond}</tds:Second>
        </tds:Time>
        <tds:Date>
          <tds:Year>${utcYear}</tds:Year>
          <tds:Month>${utcMonth}</tds:Month>
          <tds:Day>${utcDay}</tds:Day>
        </tds:Date>
      </tds:UTCDateTime>
    </tds:SetSystemDateAndTime>
  `
  await sendSoapRequest(url, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/SetSystemDateAndTime', authTime)
}

// 8. GetCapabilities (Media URL)
async function getMediaUrl(deviceUrl: string, username?: string, password?: string): Promise<string> {
  const authTime = (await getDeviceTimeForAuth(deviceUrl)) || new Date()
  const body = `
    <tds:GetCapabilities>
      <tds:Category>Media</tds:Category>
    </tds:GetCapabilities>
  `
  const xml = await sendSoapRequest(deviceUrl, body, username, password, 'http://www.onvif.org/ver10/device/wsdl/GetCapabilities', authTime)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const mediaUrl = result?.Envelope?.Body?.GetCapabilitiesResponse?.Capabilities?.Media?.XAddr
  if (!mediaUrl) throw new Error('Media Service not found')
  
  return mediaUrl
}

// 9. GetProfiles (Internal Helper)
async function getProfiles(mediaUrl: string, username?: string, password?: string) {
  const body = '<trt:GetProfiles/>'
  // Note: authTime needs to be passed or handled. We assume caller handles sync time if needed, 
  // but better to get it here if we want this to be standalone.
  // Ideally getProfiles is called by functions that already synced time.
  // For simplicity, let's allow passing authTime or fetch it.
  // To avoid circular deps or extra calls, let's reuse the one from deviceUrl logic if possible.
  // But here we only have mediaUrl. We'll fetch time from mediaUrl (usually same IP).
  const authTime = (await getDeviceTimeForAuth(mediaUrl)) || new Date()

  const xml = await sendSoapRequest(mediaUrl, body, username, password, 'http://www.onvif.org/ver10/media/wsdl/GetProfiles', authTime)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const profiles = result?.Envelope?.Body?.GetProfilesResponse?.Profiles
  if (!profiles) return []
  
  return Array.isArray(profiles) ? profiles : [profiles]
}

// 10. GetStreamUri (RTSP/HTTP)
export async function getStreamUri(deviceUrl: string, protocol: 'UDP' | 'TCP' | 'HTTP' = 'HTTP', username?: string, password?: string): Promise<{ uri: string, profileToken: string, encoding: string } | null> {
  try {
    const mediaUrl = await getMediaUrl(deviceUrl, username, password)
    const profiles = await getProfiles(mediaUrl, username, password)
    
    // Look for JPEG profile first for native browser support
    let targetProfile = profiles.find((p: any) => p.VideoEncoderConfiguration?.Encoding === 'JPEG')
    
    // If no JPEG, fallback to first profile (usually H.264)
    if (!targetProfile && profiles.length > 0) targetProfile = profiles[0]
    
    if (!targetProfile) throw new Error('No profiles found')
    
    const token = targetProfile.$?.token
    const encoding = targetProfile.VideoEncoderConfiguration?.Encoding || 'Unknown'
    
    // Get Stream URI
    const authTime = (await getDeviceTimeForAuth(deviceUrl)) || new Date()
    
    // Correct StreamSetup for ONVIF. 
    // Stream should be 'RTP-Unicast' or 'RTP-Multicast'.
    // Protocol can be UDP, TCP, RTSP, HTTP.
    const body = `
      <trt:GetStreamUri>
        <trt:StreamSetup>
          <tt:Stream>RTP-Unicast</tt:Stream>
          <tt:Transport>
            <tt:Protocol>${protocol}</tt:Protocol>
          </tt:Transport>
        </trt:StreamSetup>
        <trt:ProfileToken>${token}</trt:ProfileToken>
      </trt:GetStreamUri>
    `
    
    const xml = await sendSoapRequest(mediaUrl, body, username, password, 'http://www.onvif.org/ver10/media/wsdl/GetStreamUri', authTime)
    
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
    const result = await parser.parseStringPromise(xml)
    
    const uri = result?.Envelope?.Body?.GetStreamUriResponse?.MediaUri?.Uri
    
    if (uri) {
      return { uri, profileToken: token, encoding }
    }
    return null
  } catch (e) {
    console.error('GetStreamUri failed:', e)
    return null
  }
}

// 11. GetSnapshotUri (Refactored to use helpers)
export async function getSnapshotUri(deviceUrl: string, username?: string, password?: string): Promise<string> {
  const mediaUrl = await getMediaUrl(deviceUrl, username, password)
  const profiles = await getProfiles(mediaUrl, username, password)
  
  if (profiles.length === 0) throw new Error('No Profiles found')
  const token = profiles[0].$?.token
  if (!token) throw new Error('Profile Token not found')

  const authTime = (await getDeviceTimeForAuth(deviceUrl)) || new Date()
  const snapshotBody = `
    <trt:GetSnapshotUri>
      <trt:ProfileToken>${token}</trt:ProfileToken>
    </trt:GetSnapshotUri>
  `
  const snapshotXml = await sendSoapRequest(mediaUrl, snapshotBody, username, password, 'http://www.onvif.org/ver10/media/wsdl/GetSnapshotUri', authTime)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const snapshotResult = await parser.parseStringPromise(snapshotXml)
  const uri = snapshotResult?.Envelope?.Body?.GetSnapshotUriResponse?.MediaUri?.Uri
  
  if (!uri) throw new Error('Snapshot URI not found')
  
  return uri
}

// 10. Fetch Snapshot Image
export async function fetchSnapshot(uri: string, username?: string, password?: string): Promise<string> {
  try {
    const response = await axios.get(uri, {
      responseType: 'arraybuffer',
      auth: (username && password) ? { username, password } : undefined,
      timeout: 5000
    })
    const base64 = Buffer.from(response.data, 'binary').toString('base64')
    return `data:${response.headers['content-type']};base64,${base64}`
  } catch (e: any) {
    throw new Error(`Fetch failed: ${e.message}`)
  }
}
