import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { HttpExceptionFilter } from './utils/exception.filter';

async function bootstrap() {
  const port = process.env.PORT ?? 3000;
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (origin, callback) => {
      callback(null, true)
    },
    credentials: true
  })

  app.useGlobalFilters(new HttpExceptionFilter()); 
  
  await app.listen(port,() => {
    console.log(`API running at Port: ${port} in mode: ${process.env.NODE_ENV}`)
  });
}
bootstrap();
