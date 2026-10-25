import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { AuthModule } from './auth/auth.module';
import { PersonsModule } from './persons/persons.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { GraphModule } from './graph/graph.module';
import { AdminModule } from './admin/admin.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { FamilyBuilderModule } from './family-builder/family-builder.module';
import { SearchModule } from './search/search.module';
import { ArchiveModule } from './archive/archive.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrivacyModule } from './privacy/privacy.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { SecurityMiddleware } from './common/security.middleware';
import { PrismaModule } from './common/prisma.module';
import { SecurityModule } from './common/security.module';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    AuthModule,
    PersonsModule,
    RelationshipsModule,
    GraphModule,
    AdminModule,
    SubscriptionsModule,
    FamilyBuilderModule,
    SearchModule,
    ArchiveModule,
    AnalyticsModule,
    ModerationModule,
    NotificationsModule,
    PrivacyModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, SecurityMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
