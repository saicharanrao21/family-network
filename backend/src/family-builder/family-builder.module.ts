import { Module } from '@nestjs/common';
import { FamilyBuilderController } from './family-builder.controller';
import { FamilyBuilderService } from './family-builder.service';
@Module({ controllers:[FamilyBuilderController], providers:[FamilyBuilderService], exports:[FamilyBuilderService] })
export class FamilyBuilderModule {}
