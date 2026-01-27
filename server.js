const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 获取气体配置
app.post('/api/getConfig', async (req, res) => {
  const { ip, username, password, clientId } = req.body;
  
  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const url = `http://${ip}/CGI/State/GetTTLInfo.cgi`;
    
    console.log(`[GET CONFIG] 请求设备: ${ip}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Clientid': clientId || 'e5cd7e4891bf95d1d19206ce24a7b32e'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[GET CONFIG] 成功获取配置:`, data);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[GET CONFIG] 错误:`, error.message);
    res.json({ success: false, error: error.message });
  }
});

// 设置气体配置
app.post('/api/setConfig', async (req, res) => {
  const { ip, username, password, clientId, config } = req.body;
  
  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const url = `http://${ip}/CGI/State/SetTTLInfo.cgi`;
    
    console.log(`[SET CONFIG] 请求设备: ${ip}, 配置:`, config);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Clientid': clientId || 'e5cd7e4891bf95d1d19206ce24a7b32e',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config),
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[SET CONFIG] 设置成功:`, data);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[SET CONFIG] 错误:`, error.message);
    res.json({ success: false, error: error.message });
  }
});

// 批量获取配置
app.post('/api/batchGetConfig', async (req, res) => {
  const { devices, username, password, clientId } = req.body;
  const results = [];
  
  for (const device of devices) {
    try {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      const url = `http://${device.ip}/CGI/State/GetTTLInfo.cgi`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Clientid': clientId || 'e5cd7e4891bf95d1d19206ce24a7b32e'
        },
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      results.push({ ip: device.ip, name: device.name, success: true, data });
    } catch (error) {
      results.push({ ip: device.ip, name: device.name, success: false, error: error.message });
    }
  }
  
  res.json({ results });
});

// 批量设置配置
app.post('/api/batchSetConfig', async (req, res) => {
  const { devices, username, password, clientId, uploadPath, baudRate, enable } = req.body;
  const results = [];
  
  for (const device of devices) {
    try {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      const url = `http://${device.ip}/CGI/State/SetTTLInfo.cgi`;
      
      const config = {
        AuthID: device.authId,
        BaudRate: baudRate,
        Enable: enable,
        UploadPath: uploadPath
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Clientid': clientId || 'e5cd7e4891bf95d1d19206ce24a7b32e',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config),
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      results.push({ ip: device.ip, name: device.name, success: true, data });
    } catch (error) {
      results.push({ ip: device.ip, name: device.name, success: false, error: error.message });
    }
  }
  
  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`====================================`);
  console.log(`IPC气体配置服务已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`====================================`);
});
