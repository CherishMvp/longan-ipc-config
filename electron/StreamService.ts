import { spawn, ChildProcess } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from 'electron';
import * as path from 'path';

export class StreamService {
    private wss: WebSocketServer | null = null;
    private ffmpegProcesses: Map<string, ChildProcess> = new Map();
    private port: number = 9999; 

    constructor() {
        this.init();
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
        console.log(`[StreamService] WebSocket Server listening on port ${this.port}`);

        this.wss.on('connection', (ws: WebSocket, req) => {
            const url = new URL(req.url || '', `http://localhost:${this.port}`);
            const rtspUrl = url.searchParams.get('url');

            if (!rtspUrl) {
                console.error('[StreamService] Connection rejected: No RTSP URL provided');
                ws.close();
                return;
            }

            console.log(`[StreamService] New stream request for: ${rtspUrl}`);
            this.startFFmpeg(rtspUrl, ws);

            ws.on('close', () => {
                console.log(`[StreamService] Client disconnected, stopping FFmpeg for: ${rtspUrl}`);
                this.stopFFmpeg(rtspUrl);
            });

            ws.on('error', (err) => {
                console.error(`[StreamService] WebSocket error for ${rtspUrl}:`, err);
                this.stopFFmpeg(rtspUrl);
            });
        });
    }

    private startFFmpeg(rtspUrl: string, ws: WebSocket) {
        this.stopFFmpeg(rtspUrl);

        const ffmpegPath = this.getFFmpegPath();
        const args = [
            '-rtsp_transport', 'tcp',
            '-re', // Read input at native frame rate
            '-i', rtspUrl,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-s', '1280x720',
            '-b:v', '1500k',
            '-g', '30',
            '-an',
            '-f', 'flv',
            'pipe:1'
        ];

        console.log(`[StreamService] Executing: ${ffmpegPath} ${args.join(' ')}`);
        
        const ffmpeg = spawn(ffmpegPath, args, { 
            windowsHide: true,
            detached: false // Ensure it dies with the main process
        });
        
        this.ffmpegProcesses.set(rtspUrl, ffmpeg);

        ffmpeg.stdout.on('data', (data) => {
            if (ws.readyState === WebSocket.OPEN) {
                // Low-level buffer sending
                ws.send(data, { binary: true }, (err) => {
                    if (err) {
                        console.error(`[StreamService] Send error for ${rtspUrl}:`, err);
                        this.stopFFmpeg(rtspUrl);
                    }
                });
            }
        });

        ffmpeg.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Error') || msg.includes('failed')) {
                console.error(`[FFmpeg Error] ${rtspUrl}: ${msg}`);
            }
        });

        ffmpeg.on('error', (err) => {
            console.error(`[StreamService] FFmpeg spawn error for ${rtspUrl}:`, err);
            this.ffmpegProcesses.delete(rtspUrl);
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0 && code !== null) {
                console.error(`[StreamService] FFmpeg process exited with abnormal code ${code}`);
            }
            this.ffmpegProcesses.delete(rtspUrl);
        });
    }

    private stopFFmpeg(rtspUrl: string) {
        const ffmpeg = this.ffmpegProcesses.get(rtspUrl);
        if (ffmpeg) {
            console.log(`[StreamService] Killing FFmpeg process for ${rtspUrl}`);
            try {
                // On Windows, sometimes kill() doesn't work well, but for FFmpeg SIGKILL is usually effective
                ffmpeg.kill('SIGKILL');
            } catch (e) {
                console.error(`[StreamService] Failed to kill FFmpeg: ${e}`);
            }
            this.ffmpegProcesses.delete(rtspUrl);
        }
    }

    stopAll() {
        console.log('[StreamService] Stopping all streams...');
        const urls = Array.from(this.ffmpegProcesses.keys());
        for (const url of urls) {
            this.stopFFmpeg(url);
        }
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
    }
}
