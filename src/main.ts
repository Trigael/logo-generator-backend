import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { HttpExceptionFilter } from './utils/exception.filter';
import { SentryService } from '@ntegral/nestjs-sentry';
import { AllExceptionsFilter } from './utils/all-exception.filter';
import { RequestContextService } from './common/request-context.service';
import { SessionMiddleware } from './middleware/session.middleware';
import { SessionsService } from './sessions/sessions.service';

async function bootstrap() {
  const port = process.env.PORT ?? 3000;
  const app = await NestFactory.create(AppModule);
  const sessionService = app.get(SessionsService);
  const requestContext = app.get(RequestContextService);
  const sessionMiddleware = new SessionMiddleware(sessionService, requestContext);
  
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

  // Middlewares
  app.use(sessionMiddleware.use.bind(sessionMiddleware));

  // Handles all Exceptions | + Sentry, Logger
  app.useGlobalFilters(new HttpExceptionFilter()); 
  app.useGlobalFilters(new AllExceptionsFilter(app.get(SentryService)));
  
  await app.listen(port,() => {
    console.log(`API running at Port: ${port} in mode: ${process.env.NODE_ENV}`)
  });
}
bootstrap();
