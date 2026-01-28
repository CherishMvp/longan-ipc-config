import axios from 'axios'
import crypto from 'crypto'
import xml2js from 'xml2js'

// --- Types ---

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
  tt: 'http://www.onvif.org/ver10/schema'
}

// --- Helpers ---

function createSoapHeader(username?: string, password?: string) {
  if (!username || !password) return ''

  const created = new Date().toISOString()
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
    <s:Envelope xmlns:s="${NAMESPACES.soap}" xmlns:tds="${NAMESPACES.tds}" xmlns:tt="${NAMESPACES.tt}">
      <s:Header>${header}</s:Header>
      <s:Body>${body}</s:Body>
    </s:Envelope>
  `.trim()
}

async function sendSoapRequest(url: string, body: string, username?: string, password?: string) {
  const header = createSoapHeader(username, password)
  const envelope = createSoapEnvelope(body, header)

  try {
    const response = await axios.post(url, envelope, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver10/device/wsdl/GetNetworkInterfaces"'
      },
      timeout: 5000
    })
    return response.data
  } catch (error: any) {
    console.error('SOAP Request Error:', error.message)
    throw error
  }
}

// --- Commands ---

// 1. GetNetworkInterfaces
export async function getNetworkSettings(url: string, username?: string, password?: string): Promise<{ token: string, config: NetworkConfig }> {
  const body = '<tds:GetNetworkInterfaces/>'
  const xml = await sendSoapRequest(url, body, username, password)
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] })
  const result = await parser.parseStringPromise(xml)
  
  const interfaceInfo = result?.Envelope?.Body?.GetNetworkInterfacesResponse?.NetworkInterfaces
  if (!interfaceInfo) throw new Error('Invalid response for GetNetworkInterfaces')

  // Support array or single object
  const iface = Array.isArray(interfaceInfo) ? interfaceInfo[0] : interfaceInfo
  
  // Extract Token (needed for Set)
  // Note: ignoreAttrs: true loses the 'token' attribute. We need to preserve attributes or parse smarter.
  // Let's re-parse with attributes for this specific case or assume we need to handle it.
  // Actually, 'token' is an attribute on NetworkInterfaces tag.
  // Since I used ignoreAttrs: true, I lost it. I must switch to ignoreAttrs: false or use a better parser config.
  
  // Re-parsing just for token is expensive. Let's adjust parser config above or use regex for token (hacky but fast).
  // Better: Use a dedicated parser for this function.
  
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
      subnet: ipv4.Manual?.PrefixLength ? prefixLengthToSubnet(Number(ipv4.Manual.PrefixLength)) : '255.255.255.0', // Approximate
      gateway: '', // Gateway is in GetNetworkDefaultGateway usually, separate call
      dns1: '',
      dns2: ''
    }
  }
}

// Helper: Prefix to Subnet
function prefixLengthToSubnet(length: number) {
  const mask = ~((1 << (32 - length)) - 1)
  return [
    (mask >>> 24) & 0xff,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff
  ].join('.')
}

// Helper: Subnet to Prefix
function subnetToPrefixLength(subnet: string) {
  const parts = subnet.split('.').map(Number)
  let binary = ''
  parts.forEach(part => binary += part.toString(2).padStart(8, '0'))
  return binary.indexOf('0') === -1 ? 32 : binary.indexOf('0')
}

// 2. SetNetworkInterfaces
export async function setNetworkSettings(
  url: string, 
  token: string, 
  config: NetworkConfig, 
  username?: string, 
  password?: string
) {
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
  
  await sendSoapRequest(url, body, username, password)
  
  // Note: Gateway and DNS usually require SetNetworkDefaultGateway and SetDNS commands separately.
  // For basic IP change, SetNetworkInterfaces is key.
  
  // TODO: Add SetNetworkDefaultGateway if gateway changed
}
