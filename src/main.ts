import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  app.enableCors({
    origin: 'http://localhost:4000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
  });

  const config = new DocumentBuilder()
    .setTitle('SkyTrackR API')
    .setDescription('api document for flight searching')
    .setVersion('1.0')
    .addTag('flights')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, document);
  
  await app.listen(port);
  console.log(`Server running at http://localhost:${port}`);
}

bootstrap();
