import Transport = require('winston-transport');
import type { TransportStreamOptions } from 'winston-transport';
import axios from 'axios';
import { getSecret } from 'src/utils/helpers.util';

export class LokiTransport extends Transport {
  private readonly lokiUrl = 'https://logs-prod-012.grafana.net/loki/api/v1/push';
  private readonly username = getSecret(process.env.LOKI_USERNAME!);
  private readonly password = getSecret(process.env.LOKI_PASSWORD!);

  private lastSendTime = 0;
  private isSending = false;
  private readonly queue: { info: any; callback: () => void }[] = [];

  private readonly THROTTLE_MS = 250;

  constructor(opts?: TransportStreamOptions) {
    super(opts);
  }

  log(info: any, callback: () => void) {
    this.queue.push({ info, callback });
    this.processQueue();
  }

  private async processQueue() {
    if (this.isSending || this.queue.length === 0) return;

    this.isSending = true;

    const { info, callback } = this.queue.shift()!;
    const now = Date.now();
    const timeSinceLast = now - this.lastSendTime;

    if (timeSinceLast < this.THROTTLE_MS) {
      await new Promise((res) => setTimeout(res, this.THROTTLE_MS - timeSinceLast));
    }

    this.lastSendTime = Date.now();

    const timestamp = `${Math.floor(Date.now() / 1000)}000000000`;

    const payload = {
      streams: [
        {
          stream: {
            app: 'ai-logo-generator',
            level: info.level ?? 'info',
            module: info.context ?? 'general',
          },
          values: [
            [
              timestamp,
              JSON.stringify({
                message: String(info.message),
                traceId: info.traceId,
                ip: info.ip,
                metadata: info.metadata,
              }),
            ],
          ],
        },
      ],
    };

    try {
      await axios.post(this.lokiUrl, payload, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.error('Loki logging failed:', err.message);
    }

    callback();
    this.isSending = false;
    this.processQueue(); 
  }
}
