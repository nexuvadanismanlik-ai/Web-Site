import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { storageConfig } from './config/storage.config';
import { emailConfig } from './config/email.config';
import { publishConfig } from './config/publish.config';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ProductsModule } from './modules/products/products.module';
import { DomainsModule } from './modules/domains/domains.module';
import { PagesModule } from './modules/pages/pages.module';
import { ContentBlocksModule } from './modules/content-blocks/content-blocks.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { SeoModule } from './modules/seo/seo.module';
import { BrandingModule } from './modules/branding/branding.module';
import { StorageModule } from './modules/storage/storage.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { VersioningModule } from './modules/versioning/versioning.module';
import { EmailModule } from './modules/email/email.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { HealthModule } from './modules/health/health.module';
import { McpModule } from './modules/mcp/mcp.module';
import { WebsiteModule } from './modules/website/website.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { JwtAuthGuard } from './common/guards/jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [appConfig, databaseConfig, jwtConfig, storageConfig, emailConfig, publishConfig],
    }),
    PrismaModule,
    TenantModule,
    AuthModule,
    CompaniesModule,
    ProductsModule,
    DomainsModule,
    PagesModule,
    ContentBlocksModule,
    UsersModule,
    RolesModule,
    SeoModule,
    BrandingModule,
    StorageModule,
    FeatureFlagsModule,
    SettingsModule,
    NotificationsModule,
    VersioningModule,
    EmailModule,
    AuditLogModule,
    ActivityLogModule,
    HealthModule,
    McpModule,
    WebsiteModule,
  ],
  providers: [
    // JwtAuthGuard runs on every route. Routes that should skip auth
    // must be decorated with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RolesGuard runs after JwtAuthGuard. Routes with @Roles() enforce
    // the minimum required role; undecorated routes pass through.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant resolution to all routes so @Tenant() decorator works
    // everywhere. The middleware no longer throws on missing tenant —
    // it sets tenantContext = null and continues.
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
