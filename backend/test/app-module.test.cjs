const assert = require('node:assert/strict');
const test = require('node:test');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');
const { AuthGuard } = require('../dist/common/auth.guard');
const { PrismaService } = require('../dist/common/prisma.service');

test('AppModule resolves shared Prisma and JWT providers across feature modules', async () => {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  const app = testingModule.createNestApplication({ logger: false });
  try {
    await app.init();
    assert.ok(app.get(AuthGuard));
    assert.ok(app.get(JwtService));
  } finally {
    await app.close();
  }
});
