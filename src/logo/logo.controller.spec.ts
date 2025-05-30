import { Test, TestingModule } from '@nestjs/testing';
import { LogoController } from './logo.controller';

describe('LogoController', () => {
  let controller: LogoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogoController],
    }).compile();

    controller = module.get<LogoController>(LogoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
