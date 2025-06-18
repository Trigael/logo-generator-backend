import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import * as express from 'express';

// Filters
import { HttpExceptionFilter } from './utils/exception.filter';
import { AllExceptionsFilter } from './utils/all-exception.filter';

// Services
import { RequestContextService } from './common/request-context.service';
import { SessionsService } from './sessions/sessions.service';
import { UsersService } from './users/users.service';

// Middleware
import { SessionMiddleware } from './middleware/session.middleware';
import { ConnectSessionMiddleware } from './middleware/connect-session.middleware';
import { getSecret } from './utils/helpers.util';


async function bootstrap() {
  const port = getSecret(process.env.PORT ?? '') ?? 3000;
  const app = await NestFactory.create(AppModule);

  const sessionService = app.get(SessionsService);
  const requestContext = app.get(RequestContextService);
  const usersService = app.get(UsersService);

  const sessionMiddleware = new SessionMiddleware(sessionService, requestContext);
  const connectSessionMiddleware = new ConnectSessionMiddleware(requestContext, usersService, sessionService);
  
  app.setGlobalPrefix('api');

  app.use(express.json()); 
  app.use(express.urlencoded({ extended: true }));

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
  app.use(connectSessionMiddleware.use.bind(connectSessionMiddleware));

  // Sentry init
  Sentry.init({
    dsn: getSecret(process.env.SENTRY_DSN ?? ''),
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV ?? 'development',
  });

  // Handles all Exceptions | + Sentry, Logger
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalFilters(new AllExceptionsFilter()); 
  
  await app.listen(port,() => {
    console.log(`API running at Port: ${port} in mode: ${getSecret(process.env.NODE_ENV ?? '')}`)
  });
}
bootstrap();
