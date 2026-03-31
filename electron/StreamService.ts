import { spawn, ChildProcess } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from 'electron';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class StreamService {
    private wss: WebSocketServer | null = null;
    private sessions: Map<string, { ffmpeg: ChildProcess, lastDataTime: number }> = new Map();
    private port: number = 9999; 

    constructor() {
        this.init();
        this.startHealthCheck();
    }

    private log(sessionId: string, msg: string) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        console.log(`[${time}] [StreamService] [${sessionId.substring(0, 8)}] ${msg}`);
    }

    private getFFmpegPath(): string {
        if (!app.isPackaged) return 'ffmpeg';
        let ffmpegPath = '';
        try {
            const entryPath = require.resolve('ffmpeg-static');
            ffmpegPath = path.join(path.dirname(entryPath), 'ffmpeg.exe');
            ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
        } catch (e) {
            console.error('FFmpeg static not found', e);
        }
        return ffmpegPath || 'ffmpeg';
    }

    init() {
        if (this.wss) return;
        this.wss = new WebSocketServer({ port: this.port });
        console.log(`[StreamService] Stable Gateway listening on ${this.port}`);

        this.wss.on('connection', (ws: WebSocket, req) => {
            const sessionId = uuidv4();
            const url = new URL(req.url || '', `http://localhost:${this.port}`);
            const rtspUrl = url.searchParams.get('url');

            if (!rtspUrl) {
                ws.close();
                return;
            }

            this.log(sessionId, `Stable session requested: ${rtspUrl}`);
            this.startFFmpeg(sessionId, rtspUrl, ws);

            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.ping();
                else clearInterval(pingInterval);
            }, 10000);

            ws.on('close', () => {
                this.log(sessionId, 'Client disconnected');
                clearInterval(pingInterval);
                this.stopSession(sessionId);
            });
        });
    }

    private startFFmpeg(sessionId: string, rtspUrl: string, ws: WebSocket) {
        const ffmpegPath = this.getFFmpegPath();
        const args = [
            '-rtsp_transport', 'tcp',
            '-rtsp_flags', 'prefer_tcp',
            '-fflags', '+genpts+discardcorrupt+nobuffer', // 时间戳修复与坏包丢弃 (VLC 风格)
            '-i', rtspUrl,
            '-probesize', '1024k', 
            '-analyzeduration', '2000000', 
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-profile:v', 'main', 
            '-level', '3.1',
            '-s', '1280x720',
            '-b:v', '2000k', 
            '-bufsize', '4000k', // 增大主进程缓冲区
            '-maxrate', '2500k',
            '-g', '50',
            '-r', '25', // 强制帧率，防止浏览器时钟同步失效
            '-an',
            '-f', 'flv',
            'pipe:1'
        ];

        const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
        this.sessions.set(sessionId, { ffmpeg, lastDataTime: Date.now() });

        ffmpeg.stdout.on('data', (data) => {
            const session = this.sessions.get(sessionId);
            if (session) session.lastDataTime = Date.now();
            
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data, { binary: true });
            }
        });

        ffmpeg.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Error') || msg.includes('failed')) {
                this.log(sessionId, `FFmpeg: ${msg.trim()}`);
            }
        });

        ffmpeg.on('close', (code, signal) => {
            this.log(sessionId, `FFmpeg closed. Code: ${code}, Signal: ${signal}`);
            this.sessions.delete(sessionId);
        });
    }

    private startHealthCheck() {
        // 每 5 秒检查一次流状态，如果发现 FFmpeg 还在跑但没数据吐出来，强制重启
        setInterval(() => {
            const now = Date.now();
            this.sessions.forEach((session, id) => {
                if (now - session.lastDataTime > 5000) {
                    this.log(id, 'Stream stalled (No data for 5s), killing for restart...');
                    session.ffmpeg.kill('SIGKILL');
                }
            });
        }, 5000);
    }

    private stopSession(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.ffmpeg.kill('SIGKILL');
            this.sessions.delete(sessionId);
        }
    }

    stopAll() {
        Array.from(this.sessions.keys()).forEach(id => this.stopSession(id));
        this.wss?.close();
    }
}
