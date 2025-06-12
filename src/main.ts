import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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

  // Swagger set up
  const config = new DocumentBuilder()
    .setTitle('Docs example')
    .setDescription('The API documentation')
    .setVersion('1.0')
    .addTag('cats')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  app.useGlobalFilters(new HttpExceptionFilter()); 
  
  await app.listen(port,() => {
    console.log(`API running at Port: ${port} in mode: ${process.env.NODE_ENV}`)
  });
}
bootstrap();
