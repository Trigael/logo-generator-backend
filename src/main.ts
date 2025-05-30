import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT ?? 3000;
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  
  await app.listen(port,() => {
    console.log(`API running at Port: ${port} in mode: ${process.env.NODE_ENV}`)
  });
}
bootstrap();
