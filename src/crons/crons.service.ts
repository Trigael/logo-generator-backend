import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

// Services
import { LogoService } from 'src/logo/logo.service';

@Injectable()
export class CronsService {
    private readonly delete_logo_after = 30 // in days

    constructor(
        private readonly logoService: LogoService,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleUnboughtLogos() {
        await this.logoService.deleteUnboughtLogosOlderThan(this.delete_logo_after)
    }
}
