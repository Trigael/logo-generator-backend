import { Module } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PromptsService],
  exports: [PromptsService]
})
export class PromptsModule {}
