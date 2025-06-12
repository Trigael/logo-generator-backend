import { Module } from '@nestjs/common';
import { ProductTypesService } from './product_types.service';

// Modules
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    DatabaseModule,
  ],
  providers: [ProductTypesService],
  exports: [ProductTypesService],
})
export class ProductTypesModule {}
